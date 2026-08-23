-- JANG LONG
-- Disposable smoke test for public.expire_guest_checkouts().
--
-- It uses product 0008 and verifies future, no-attempt, pending, unknown,
-- failed, cancelled, and succeeded payment states. Every change is rolled
-- back at the end.

begin;

do $$
declare
    v_product_id constant text := '0008';
    v_product_price integer;
    v_order_id uuid;
    v_result record;
begin
    if has_function_privilege(
        'anon',
        'public.expire_guest_checkouts(integer)',
        'EXECUTE'
    ) then
        raise exception 'Anonymous role can execute the private expiry function';
    end if;

    if has_function_privilege(
        'authenticated',
        'public.expire_guest_checkouts(integer)',
        'EXECUTE'
    ) then
        raise exception 'Authenticated role can execute the private expiry function';
    end if;

    select products.price
    into v_product_price
    from public.products as products
    where products.id = v_product_id
      and products.is_published = true
      and products.status = 'available'
      and products.reserved_order_id is null
    for update;

    if v_product_price is null then
        raise exception
            'Test product % must be published and available',
            v_product_id;
    end if;

    -- 1. A reservation whose deadline has not arrived must stay protected.
    insert into public.orders (
        order_number,
        checkout_key_hash,
        recovery_token_hash,
        customer_name,
        customer_phone,
        customer_email,
        postal_code,
        address_line1,
        subtotal,
        reservation_started_at,
        reservation_expires_at
    )
    values (
        'TEST-FUTURE-' || gen_random_uuid()::text,
        'future-' || gen_random_uuid()::text,
        'future-recovery-' || gen_random_uuid()::text,
        'Test Customer',
        '010-0000-0000',
        'test@example.invalid',
        '00000',
        'Test address',
        v_product_price,
        clock_timestamp(),
        clock_timestamp() + interval '10 minutes'
    )
    returning id into v_order_id;

    update public.products
    set
        status = 'reserved',
        reserved_order_id = v_order_id
    where id = v_product_id;

    select *
    into v_result
    from public.expire_guest_checkouts(100);

    if v_result.expired_order_count <> 0
       or v_result.released_product_count <> 0
       or not exists (
           select 1
           from public.products
           where id = v_product_id
             and status = 'reserved'
             and reserved_order_id = v_order_id
       ) then
        raise exception 'Future reservation was released';
    end if;

    -- Move the same reservation into the past. With no payment attempt, it
    -- must now expire and release the product.
    update public.orders
    set
        reservation_started_at = clock_timestamp() - interval '20 minutes',
        reservation_expires_at = clock_timestamp() - interval '10 minutes'
    where id = v_order_id;

    select *
    into v_result
    from public.expire_guest_checkouts(100);

    if v_result.expired_order_count <> 1
       or v_result.released_product_count <> 1
       or not exists (
           select 1
           from public.orders
           where id = v_order_id
             and status = 'expired'
             and expired_at is not null
       )
       or not exists (
           select 1
           from public.products
           where id = v_product_id
             and status = 'available'
             and reserved_order_id is null
       ) then
        raise exception 'No-attempt expiry verification failed';
    end if;

    -- Repeating cleanup must do nothing. This makes retries harmless.
    select *
    into v_result
    from public.expire_guest_checkouts(100);

    if v_result.expired_order_count <> 0
       or v_result.released_product_count <> 0 then
        raise exception 'Expiry function is not idempotent';
    end if;

    -- 2. Pending and unknown payment results must stay protected. Once the
    -- same attempt is confirmed failed, the expired reservation may release.
    insert into public.orders (
        order_number,
        checkout_key_hash,
        recovery_token_hash,
        customer_name,
        customer_phone,
        customer_email,
        postal_code,
        address_line1,
        subtotal,
        reservation_started_at,
        reservation_expires_at
    )
    values (
        'TEST-PAYMENT-' || gen_random_uuid()::text,
        'payment-' || gen_random_uuid()::text,
        'payment-recovery-' || gen_random_uuid()::text,
        'Test Customer',
        '010-0000-0000',
        'test@example.invalid',
        '00000',
        'Test address',
        v_product_price,
        clock_timestamp() - interval '20 minutes',
        clock_timestamp() - interval '10 minutes'
    )
    returning id into v_order_id;

    update public.products
    set
        status = 'reserved',
        reserved_order_id = v_order_id
    where id = v_product_id;

    insert into public.payment_attempts (
        order_id,
        attempt_number,
        request_key_hash,
        amount,
        status
    )
    values (
        v_order_id,
        1,
        'pending-' || gen_random_uuid()::text,
        v_product_price,
        'pending'
    );

    select *
    into v_result
    from public.expire_guest_checkouts(100);

    if v_result.expired_order_count <> 0
       or not exists (
           select 1
           from public.products
           where id = v_product_id
             and status = 'reserved'
             and reserved_order_id = v_order_id
       ) then
        raise exception 'Pending payment was not protected';
    end if;

    update public.payment_attempts
    set status = 'unknown'
    where order_id = v_order_id;

    select *
    into v_result
    from public.expire_guest_checkouts(100);

    if v_result.expired_order_count <> 0 then
        raise exception 'Unknown payment was not protected';
    end if;

    update public.payment_attempts
    set status = 'failed'
    where order_id = v_order_id;

    select *
    into v_result
    from public.expire_guest_checkouts(100);

    if v_result.expired_order_count <> 1
       or v_result.released_product_count <> 1
       or not exists (
           select 1
           from public.products
           where id = v_product_id
             and status = 'available'
             and reserved_order_id is null
       ) then
        raise exception 'Confirmed failed payment did not release';
    end if;

    -- 3. A cancelled result is also confirmed non-payment and may release.
    insert into public.orders (
        order_number,
        checkout_key_hash,
        recovery_token_hash,
        customer_name,
        customer_phone,
        customer_email,
        postal_code,
        address_line1,
        subtotal,
        reservation_started_at,
        reservation_expires_at
    )
    values (
        'TEST-CANCELLED-' || gen_random_uuid()::text,
        'cancelled-' || gen_random_uuid()::text,
        'cancelled-recovery-' || gen_random_uuid()::text,
        'Test Customer',
        '010-0000-0000',
        'test@example.invalid',
        '00000',
        'Test address',
        v_product_price,
        clock_timestamp() - interval '20 minutes',
        clock_timestamp() - interval '10 minutes'
    )
    returning id into v_order_id;

    update public.products
    set
        status = 'reserved',
        reserved_order_id = v_order_id
    where id = v_product_id;

    insert into public.payment_attempts (
        order_id,
        attempt_number,
        request_key_hash,
        amount,
        status
    )
    values (
        v_order_id,
        1,
        'cancelled-' || gen_random_uuid()::text,
        v_product_price,
        'cancelled'
    );

    select *
    into v_result
    from public.expire_guest_checkouts(100);

    if v_result.expired_order_count <> 1
       or v_result.released_product_count <> 1
       or not exists (
           select 1
           from public.orders
           where id = v_order_id
             and status = 'expired'
       )
       or not exists (
           select 1
           from public.products
           where id = v_product_id
             and status = 'available'
             and reserved_order_id is null
       ) then
        raise exception 'Confirmed cancelled payment did not release';
    end if;

    -- 4. A succeeded payment must never be returned to available, even if
    -- the order finalization callback has not changed the order to paid yet.
    insert into public.orders (
        order_number,
        checkout_key_hash,
        recovery_token_hash,
        customer_name,
        customer_phone,
        customer_email,
        postal_code,
        address_line1,
        subtotal,
        reservation_started_at,
        reservation_expires_at
    )
    values (
        'TEST-SUCCEEDED-' || gen_random_uuid()::text,
        'succeeded-' || gen_random_uuid()::text,
        'succeeded-recovery-' || gen_random_uuid()::text,
        'Test Customer',
        '010-0000-0000',
        'test@example.invalid',
        '00000',
        'Test address',
        v_product_price,
        clock_timestamp() - interval '20 minutes',
        clock_timestamp() - interval '10 minutes'
    )
    returning id into v_order_id;

    update public.products
    set
        status = 'reserved',
        reserved_order_id = v_order_id
    where id = v_product_id;

    insert into public.payment_attempts (
        order_id,
        attempt_number,
        request_key_hash,
        amount,
        status
    )
    values (
        v_order_id,
        1,
        'succeeded-' || gen_random_uuid()::text,
        v_product_price,
        'succeeded'
    );

    select *
    into v_result
    from public.expire_guest_checkouts(100);

    if v_result.expired_order_count <> 0
       or v_result.released_product_count <> 0
       or not exists (
           select 1
           from public.orders
           where id = v_order_id
             and status = 'pending_payment'
       )
       or not exists (
           select 1
           from public.products
           where id = v_product_id
             and status = 'reserved'
             and reserved_order_id = v_order_id
       ) then
        raise exception 'Succeeded payment was released';
    end if;
end;
$$;

rollback;

select
    'PASS: guest checkout expiry verified; all test changes rolled back' as result;