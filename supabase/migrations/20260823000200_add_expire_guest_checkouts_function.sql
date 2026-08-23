-- JANG LONG
-- Safely expire guest checkout reservations in small, repeatable batches.
--
-- Safe to create now, but do not schedule it yet. Automatic execution should
-- be enabled only after the trusted checkout backend and payment-status
-- reconciliation are implemented and tested together.
--
-- Release rules:
--   * no payment attempt: release after the fixed reservation deadline
--   * only failed/cancelled attempts: release after the deadline
--   * pending/unknown/succeeded attempt: keep the reservation protected

begin;

create or replace function public.expire_guest_checkouts(
    p_batch_size integer default 100
)
returns table (
    expired_order_count integer,
    released_product_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamp with time zone := clock_timestamp();
    v_order_id uuid;
    v_order_updated_count integer;
    v_products_released_count integer;
begin
    if p_batch_size is null
       or p_batch_size < 1
       or p_batch_size > 500 then
        raise exception 'INVALID_BATCH_SIZE';
    end if;

    expired_order_count := 0;
    released_product_count := 0;

    -- Lock each order before reading its payment state. Future payment-start
    -- and payment-finalization functions must lock the same order first so
    -- payment and expiry can never update one order at the same time.
    for v_order_id in
        select orders.id
        from public.orders as orders
        where orders.status = 'pending_payment'
          and orders.reservation_expires_at <= v_now
        order by
            orders.reservation_expires_at,
            orders.id
        for update skip locked
        limit p_batch_size
    loop
        -- A payment may be approved while its result is still travelling back
        -- to JANG LONG. Never release an order whose result is unfinished,
        -- unknown, or already successful.
        if exists (
            select 1
            from public.payment_attempts as attempts
            where attempts.order_id = v_order_id
              and attempts.status in ('pending', 'unknown', 'succeeded')
        ) then
            continue;
        end if;

        update public.products as products
        set
            status = 'available',
            reserved_order_id = null
        where products.status = 'reserved'
          and products.reserved_order_id = v_order_id;

        get diagnostics v_products_released_count = row_count;

        update public.orders as orders
        set
            status = 'expired',
            expired_at = coalesce(orders.expired_at, v_now)
        where orders.id = v_order_id
          and orders.status = 'pending_payment'
          and orders.reservation_expires_at <= v_now;

        get diagnostics v_order_updated_count = row_count;

        if v_order_updated_count = 1 then
            expired_order_count :=
                expired_order_count + 1;

            released_product_count :=
                released_product_count + v_products_released_count;
        end if;
    end loop;

    return next;
end;
$$;

comment on function public.expire_guest_checkouts(integer) is
'Private batch cleanup for expired guest checkout reservations. Pending, unknown, and succeeded payment attempts remain protected.';

-- This changes orders and product availability, so the browser must never be
-- allowed to call it. Only the trusted backend role may execute it.
revoke all on function public.expire_guest_checkouts(integer)
from public, anon, authenticated;

grant execute on function public.expire_guest_checkouts(integer)
to service_role;

commit;