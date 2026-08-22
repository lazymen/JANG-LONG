-- JANG LONG
-- Disposable smoke test for the order and reservation foundation.
--
-- This test uses product 0008, verifies the intended relationships and
-- state changes, and rolls back every change before returning PASS.

begin;

do $$
declare
    test_product_id constant text := '0008';
    test_order_id uuid;
    test_price integer;
    affected_rows integer;
begin
    select price
    into test_price
    from public.products
    where id = test_product_id
      and is_published = true
      and status = 'available'
    for update;

    if test_price is null then
        raise exception
            'Test product % must be published and available',
            test_product_id;
    end if;

    insert into public.orders (
        order_number,
        checkout_key_hash,
        recovery_token_hash,
        customer_name,
        customer_phone,
        customer_email,
        postal_code,
        address_line1,
        address_line2,
        delivery_note,
        subtotal,
        shipping_fee,
        reservation_expires_at
    )
    values (
        'TEST-' || gen_random_uuid()::text,
        'TEST-CHECKOUT-' || gen_random_uuid()::text,
        'TEST-RECOVERY-' || gen_random_uuid()::text,
        'Test Customer',
        '010-0000-0000',
        'test@example.invalid',
        '00000',
        'Test address',
        '',
        '',
        test_price,
        0,
        now() + interval '10 minutes'
    )
    returning id into test_order_id;

    insert into public.order_items (
        order_id,
        product_id,
        product_name,
        unit_price,
        size,
        image_path
    )
    select
        test_order_id,
        id,
        name,
        price,
        size,
        'images/products/' || id || '/' || images[1]
    from public.products
    where id = test_product_id;

    insert into public.payment_attempts (
        order_id,
        attempt_number,
        request_key_hash,
        provider,
        amount,
        status
    )
    values (
        test_order_id,
        1,
        'TEST-REQUEST-' || gen_random_uuid()::text,
        'mock',
        test_price,
        'pending'
    );

    update public.products
    set
        status = 'reserved',
        reserved_order_id = test_order_id
    where id = test_product_id
      and status = 'available'
      and reserved_order_id is null;

    get diagnostics affected_rows = row_count;

    if affected_rows <> 1 then
        raise exception
            'Expected one reserved product, got %',
            affected_rows;
    end if;

    if not exists (
        select 1
        from public.orders as orders
        join public.order_items as items
          on items.order_id = orders.id
        join public.payment_attempts as payments
          on payments.order_id = orders.id
        join public.products as products
          on products.id = items.product_id
        where orders.id = test_order_id
          and orders.status = 'pending_payment'
          and orders.total_amount = test_price
          and payments.status = 'pending'
          and products.status = 'reserved'
          and products.reserved_order_id = test_order_id
    ) then
        raise exception 'Reservation relationship verification failed';
    end if;

    -- An unknown payment result must keep the original reservation.
    update public.payment_attempts
    set status = 'unknown'
    where order_id = test_order_id
      and attempt_number = 1;

    if not exists (
        select 1
        from public.products
        where id = test_product_id
          and status = 'reserved'
          and reserved_order_id = test_order_id
    ) then
        raise exception 'Unknown payment result released the reservation';
    end if;

    -- A confirmed failure cancels the order and releases the product.
    update public.payment_attempts
    set
        status = 'failed',
        failure_code = 'TEST_FAILURE',
        failure_message = 'Disposable smoke test'
    where order_id = test_order_id
      and attempt_number = 1;

    update public.orders
    set
        status = 'cancelled',
        cancelled_at = now()
    where id = test_order_id;

    update public.products
    set
        status = 'available',
        reserved_order_id = null
    where id = test_product_id
      and reserved_order_id = test_order_id;

    if not exists (
        select 1
        from public.orders as orders
        join public.payment_attempts as payments
          on payments.order_id = orders.id
        join public.products as products
          on products.id = test_product_id
        where orders.id = test_order_id
          and orders.status = 'cancelled'
          and payments.status = 'failed'
          and products.status = 'available'
          and products.reserved_order_id is null
    ) then
        raise exception 'Confirmed failure release verification failed';
    end if;
end;
$$;

rollback;

select
    'PASS: order foundation verified; all test changes rolled back' as result;