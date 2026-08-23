-- JANG LONG
-- Disposable smoke test for public.start_guest_checkout().
-- Version: server-calculated shipping
--
-- It uses product 0008, checks authoritative pricing, server-calculated
-- shipping, reservation, and safe retry behavior, then rolls back every test
-- change.

begin;

do $$
declare
    v_product_id constant text := '0008';
    v_checkout_key_hash text :=
        replace(gen_random_uuid()::text, '-', '') ||
        replace(gen_random_uuid()::text, '-', '');
    v_recovery_token_hash text :=
        replace(gen_random_uuid()::text, '-', '') ||
        replace(gen_random_uuid()::text, '-', '');
    v_failed_checkout_key_hash text :=
        replace(gen_random_uuid()::text, '-', '') ||
        replace(gen_random_uuid()::text, '-', '');
    v_failed_recovery_token_hash text :=
        replace(gen_random_uuid()::text, '-', '') ||
        replace(gen_random_uuid()::text, '-', '');

    v_server_price integer;
    v_expected_shipping_fee integer;
    v_first record;
    v_retry record;
    v_expected_error_seen boolean := false;
    v_changed_remote_error_seen boolean := false;
begin
    if has_function_privilege(
        'anon',
        'public.start_guest_checkout(text,text,text,text,text,text,text,text,text,text[],boolean)',
        'EXECUTE'
    ) then
        raise exception 'Anonymous role can execute the private checkout function';
    end if;

    if has_function_privilege(
        'authenticated',
        'public.start_guest_checkout(text,text,text,text,text,text,text,text,text,text[],boolean)',
        'EXECUTE'
    ) then
        raise exception 'Authenticated role can execute the private checkout function';
    end if;

    select products.price
    into v_server_price
    from public.products as products
    where products.id = v_product_id
      and products.is_published = true
      and products.status = 'available'
      and products.reserved_order_id is null;

    if v_server_price is null then
        raise exception
            'Test product % must be published and available',
            v_product_id;
    end if;

    v_expected_shipping_fee :=
        public.calculate_checkout_shipping_fee(v_server_price, false);

    select *
    into v_first
    from public.start_guest_checkout(
        v_checkout_key_hash,
        v_recovery_token_hash,
        'Test Customer',
        '010-0000-0000',
        'test@example.invalid',
        '00000',
        'Test address',
        '',
        '',
        array[v_product_id],
        false
    );

    if v_first.was_created is not true
       or v_first.order_status <> 'pending_payment'
       or v_first.subtotal <> v_server_price
       or v_first.shipping_fee <> v_expected_shipping_fee
       or v_first.total_amount
          <> v_server_price + v_expected_shipping_fee
       or v_first.reservation_expires_at - v_first.reservation_started_at
          <> interval '10 minutes' then
        raise exception 'New checkout result verification failed';
    end if;

    if not exists (
        select 1
        from public.products as products
        join public.order_items as items
          on items.product_id = products.id
        where products.id = v_product_id
          and products.status = 'reserved'
          and products.reserved_order_id = v_first.order_id
          and items.order_id = v_first.order_id
          and items.unit_price = v_server_price
          and items.product_name = products.name
          and exists (
              select 1
              from public.orders as orders
              where orders.id = v_first.order_id
                and orders.is_remote_area is false
                and orders.shipping_fee = v_expected_shipping_fee
          )
    ) then
        raise exception 'Authoritative product snapshot verification failed';
    end if;

    -- The same checkout key must return the original order. It must not create
    -- another order or reset the 10-minute reservation.
    select *
    into v_retry
    from public.start_guest_checkout(
        v_checkout_key_hash,
        v_recovery_token_hash,
        'Test Customer',
        '010-0000-0000',
        'test@example.invalid',
        '00000',
        'Test address',
        '',
        '',
        array[v_product_id],
        false
    );

    if v_retry.was_created is not false
       or v_retry.order_id <> v_first.order_id
       or v_retry.reservation_started_at <> v_first.reservation_started_at
       or v_retry.reservation_expires_at <> v_first.reservation_expires_at then
        raise exception 'Safe retry verification failed';
    end if;

    if (
        select count(*)
        from public.orders as orders
        where orders.checkout_key_hash = v_checkout_key_hash
    ) <> 1 then
        raise exception 'Duplicate order was created';
    end if;

    -- The same checkout key cannot be reused with a changed remote-area
    -- classification. The original order amount and reservation stay fixed.
    begin
        perform *
        from public.start_guest_checkout(
            v_checkout_key_hash,
            v_recovery_token_hash,
            'Test Customer',
            '010-0000-0000',
            'test@example.invalid',
            '00000',
            'Test address',
            '',
            '',
            array[v_product_id],
            true
        );
    exception
        when others then
            if sqlerrm = 'CHECKOUT_KEY_REUSED_WITH_DIFFERENT_DATA' then
                v_changed_remote_error_seen := true;
            else
                raise;
            end if;
    end;

    if v_changed_remote_error_seen is not true then
        raise exception 'Changed remote-area retry did not fail';
    end if;

    -- A request containing an unavailable or nonexistent product must fail.
    -- The exception is intentionally caught so the rest of the test can verify
    -- that no partial order was left behind.
    begin
        perform *
        from public.start_guest_checkout(
            v_failed_checkout_key_hash,
            v_failed_recovery_token_hash,
            'Test Customer',
            '010-0000-0000',
            'test@example.invalid',
            '00000',
            'Test address',
            '',
            '',
            array[v_product_id, '9999'],
            false
        );
    exception
        when others then
            if sqlerrm = 'CHECKOUT_PRODUCTS_UNAVAILABLE' then
                v_expected_error_seen := true;
            else
                raise;
            end if;
    end;

    if v_expected_error_seen is not true then
        raise exception 'Unavailable product request did not fail';
    end if;

    if exists (
        select 1
        from public.orders as orders
        where orders.checkout_key_hash = v_failed_checkout_key_hash
    ) then
        raise exception 'Failed checkout left a partial order';
    end if;
end;
$$;

rollback;

select
    'PASS: atomic guest checkout with server shipping verified; all test changes rolled back' as result;