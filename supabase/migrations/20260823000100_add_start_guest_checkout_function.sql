-- JANG LONG
-- Create one private, atomic entry point for starting guest checkout.
--
-- The browser must never call this function directly. A trusted backend
-- (Supabase Edge Function) will call it later with the service_role.
--
-- Do not connect this function to the storefront until reservation expiry,
-- server-side shipping calculation, and the Edge Function are implemented.

begin;

create or replace function public.start_guest_checkout(
    p_checkout_key_hash text,
    p_recovery_token_hash text,
    p_customer_name text,
    p_customer_phone text,
    p_customer_email text,
    p_postal_code text,
    p_address_line1 text,
    p_address_line2 text,
    p_delivery_note text,
    p_product_ids text[],
    p_shipping_fee integer
)
returns table (
    order_id uuid,
    order_number text,
    order_status text,
    subtotal integer,
    shipping_fee integer,
    total_amount integer,
    reservation_started_at timestamp with time zone,
    reservation_expires_at timestamp with time zone,
    was_created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamp with time zone := clock_timestamp();

    v_checkout_key_hash text := lower(btrim(p_checkout_key_hash));
    v_recovery_token_hash text := lower(btrim(p_recovery_token_hash));

    v_customer_name text := btrim(p_customer_name);
    v_customer_phone text := btrim(p_customer_phone);
    v_customer_email text := lower(btrim(p_customer_email));
    v_postal_code text := btrim(p_postal_code);
    v_address_line1 text := btrim(p_address_line1);
    v_address_line2 text := btrim(coalesce(p_address_line2, ''));
    v_delivery_note text := btrim(coalesce(p_delivery_note, ''));

    v_product_ids text[];
    v_requested_count integer;
    v_distinct_count integer;
    v_loaded_count integer;
    v_available_count integer;
    v_reserved_count integer;
    v_subtotal integer;

    v_order_id uuid;
    v_order_number text;
    v_existing_order public.orders%rowtype;
    v_existing_product_ids text[];
begin
    -- These are SHA-256 hashes. Raw checkout and recovery tokens are never
    -- stored in the database.
    if v_checkout_key_hash is null
       or v_checkout_key_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'INVALID_CHECKOUT_KEY';
    end if;

    if v_recovery_token_hash is null
       or v_recovery_token_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'INVALID_RECOVERY_TOKEN';
    end if;

    if v_customer_name is null
       or v_customer_name = ''
       or char_length(v_customer_name) > 80 then
        raise exception 'INVALID_CUSTOMER_NAME';
    end if;

    if v_customer_phone is null
       or v_customer_phone = ''
       or char_length(v_customer_phone) > 20 then
        raise exception 'INVALID_CUSTOMER_PHONE';
    end if;

    if v_customer_email is null
       or v_customer_email = ''
       or char_length(v_customer_email) > 120 then
        raise exception 'INVALID_CUSTOMER_EMAIL';
    end if;

    if v_postal_code is null
       or v_postal_code = ''
       or char_length(v_postal_code) > 20 then
        raise exception 'INVALID_POSTAL_CODE';
    end if;

    if v_address_line1 is null
       or v_address_line1 = ''
       or char_length(v_address_line1) > 160 then
        raise exception 'INVALID_ADDRESS';
    end if;

    if char_length(v_address_line2) > 160 then
        raise exception 'INVALID_DETAIL_ADDRESS';
    end if;

    if char_length(v_delivery_note) > 300 then
        raise exception 'INVALID_DELIVERY_NOTE';
    end if;

    if p_shipping_fee is null or p_shipping_fee < 0 then
        raise exception 'INVALID_SHIPPING_FEE';
    end if;

    if p_product_ids is null or cardinality(p_product_ids) = 0 then
        raise exception 'EMPTY_CART';
    end if;

    if exists (
        select 1
        from unnest(p_product_ids) as requested(product_id)
        where requested.product_id is null
           or btrim(requested.product_id) !~ '^[0-9]{4}$'
    ) then
        raise exception 'INVALID_PRODUCT_ID';
    end if;

    select
        array_agg(btrim(requested.product_id) order by btrim(requested.product_id)),
        count(*)::integer,
        count(distinct btrim(requested.product_id))::integer
    into
        v_product_ids,
        v_requested_count,
        v_distinct_count
    from unnest(p_product_ids) as requested(product_id);

    if v_requested_count <> v_distinct_count then
        raise exception 'DUPLICATE_PRODUCT_ID';
    end if;

    -- Only one transaction may process the same checkout key at a time.
    -- Retrying the same checkout therefore returns the original order instead
    -- of creating a second order or extending the reservation.
    perform pg_advisory_xact_lock(
        hashtextextended(v_checkout_key_hash, 0)
    );

    select existing.*
    into v_existing_order
    from public.orders as existing
    where existing.checkout_key_hash = v_checkout_key_hash;

    if found then
        select coalesce(
            array_agg(items.product_id order by items.product_id),
            array[]::text[]
        )
        into v_existing_product_ids
        from public.order_items as items
        where items.order_id = v_existing_order.id;

        if v_existing_order.recovery_token_hash <> v_recovery_token_hash
           or v_existing_order.customer_name <> v_customer_name
           or v_existing_order.customer_phone <> v_customer_phone
           or v_existing_order.customer_email <> v_customer_email
           or v_existing_order.postal_code <> v_postal_code
           or v_existing_order.address_line1 <> v_address_line1
           or v_existing_order.address_line2 <> v_address_line2
           or v_existing_order.delivery_note <> v_delivery_note
           or v_existing_order.shipping_fee <> p_shipping_fee
           or v_existing_product_ids <> v_product_ids then
            raise exception 'CHECKOUT_KEY_REUSED_WITH_DIFFERENT_DATA';
        end if;

        if v_existing_order.status = 'pending_payment'
           and v_existing_order.reservation_expires_at <= v_now then
            raise exception 'CHECKOUT_RESERVATION_EXPIRED';
        end if;

        if v_existing_order.status = 'pending_payment'
           and (
               select count(*)
               from public.order_items as items
               join public.products as products
                 on products.id = items.product_id
               where items.order_id = v_existing_order.id
                 and products.status = 'reserved'
                 and products.reserved_order_id = v_existing_order.id
           ) <> v_requested_count then
            raise exception 'CHECKOUT_RESERVATION_INCONSISTENT';
        end if;

        if v_existing_order.status not in ('pending_payment', 'paid') then
            raise exception 'CHECKOUT_SESSION_CLOSED';
        end if;

        return query
        select
            v_existing_order.id,
            v_existing_order.order_number,
            v_existing_order.status,
            v_existing_order.subtotal,
            v_existing_order.shipping_fee,
            v_existing_order.total_amount,
            v_existing_order.reservation_started_at,
            v_existing_order.reservation_expires_at,
            false;

        return;
    end if;

    -- Lock product rows in a stable order. A second customer trying to reserve
    -- the same item must wait and will then see that it is unavailable.
    perform products.id
    from public.products as products
    where products.id = any(v_product_ids)
    order by products.id
    for update;

    select
        count(*)::integer,
        count(*) filter (
            where products.is_published = true
              and products.status = 'available'
              and products.reserved_order_id is null
        )::integer,
        coalesce(sum(products.price), 0)::integer
    into
        v_loaded_count,
        v_available_count,
        v_subtotal
    from public.products as products
    where products.id = any(v_product_ids);

    if v_loaded_count <> v_requested_count
       or v_available_count <> v_requested_count then
        raise exception 'CHECKOUT_PRODUCTS_UNAVAILABLE';
    end if;

    v_order_id := gen_random_uuid();
    v_order_number :=
        'JL-' || upper(replace(v_order_id::text, '-', ''));

    insert into public.orders (
        id,
        order_number,
        checkout_key_hash,
        recovery_token_hash,
        status,
        customer_name,
        customer_phone,
        customer_email,
        postal_code,
        address_line1,
        address_line2,
        delivery_note,
        subtotal,
        shipping_fee,
        reservation_started_at,
        reservation_expires_at
    )
    values (
        v_order_id,
        v_order_number,
        v_checkout_key_hash,
        v_recovery_token_hash,
        'pending_payment',
        v_customer_name,
        v_customer_phone,
        v_customer_email,
        v_postal_code,
        v_address_line1,
        v_address_line2,
        v_delivery_note,
        v_subtotal,
        p_shipping_fee,
        v_now,
        v_now + interval '10 minutes'
    );

    insert into public.order_items (
        order_id,
        product_id,
        product_name,
        unit_price,
        size,
        image_path
    )
    select
        v_order_id,
        products.id,
        products.name,
        products.price,
        products.size,
        'images/products/' || products.id || '/' || products.images[1]
    from public.products as products
    where products.id = any(v_product_ids)
    order by products.id;

    update public.products as products
    set
        status = 'reserved',
        reserved_order_id = v_order_id
    where products.id = any(v_product_ids)
      and products.is_published = true
      and products.status = 'available'
      and products.reserved_order_id is null;

    get diagnostics v_reserved_count = row_count;

    if v_reserved_count <> v_requested_count then
        raise exception 'CHECKOUT_PRODUCTS_UNAVAILABLE';
    end if;

    return query
    select
        orders.id,
        orders.order_number,
        orders.status,
        orders.subtotal,
        orders.shipping_fee,
        orders.total_amount,
        orders.reservation_started_at,
        orders.reservation_expires_at,
        true
    from public.orders as orders
    where orders.id = v_order_id;
end;
$$;

comment on function public.start_guest_checkout(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text[],
    integer
) is
'Private atomic guest checkout entry point. Call from a trusted backend only.';

-- PostgreSQL grants function execution to PUBLIC by default. Remove that
-- default and allow only the trusted backend role.
revoke all on function public.start_guest_checkout(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text[],
    integer
) from public, anon, authenticated;

grant execute on function public.start_guest_checkout(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text[],
    integer
) to service_role;

commit;