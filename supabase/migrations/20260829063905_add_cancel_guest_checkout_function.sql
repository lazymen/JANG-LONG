begin;

create function public.cancel_guest_checkout(
    p_checkout_key_hash text,
    p_recovery_token_hash text
)
returns table (
    order_id uuid,
    order_number text,
    order_status text,
    released_product_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamp with time zone := clock_timestamp();
    v_checkout_key_hash text := lower(btrim(p_checkout_key_hash));
    v_recovery_token_hash text := lower(btrim(p_recovery_token_hash));
    v_order public.orders%rowtype;
    v_released_product_count integer := 0;
begin
    if v_checkout_key_hash is null
       or v_checkout_key_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'INVALID_CHECKOUT_KEY';
    end if;

    if v_recovery_token_hash is null
       or v_recovery_token_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'INVALID_RECOVERY_TOKEN';
    end if;

    select orders.*
    into v_order
    from public.orders as orders
    where orders.checkout_key_hash = v_checkout_key_hash
      and orders.recovery_token_hash = v_recovery_token_hash
    for update;

    if not found then
        raise exception 'CHECKOUT_RECOVERY_NOT_FOUND';
    end if;

    if v_order.status <> 'pending_payment' then
        raise exception 'CHECKOUT_SESSION_CLOSED';
    end if;

    -- 미래에 PG가 붙어도 결제 확인 중·성공 상태의 상품은
    -- 브라우저 취소 요청으로 절대 풀리지 않게 보호한다.
    if exists (
        select 1
        from public.payment_attempts as attempts
        where attempts.order_id = v_order.id
          and attempts.status in ('pending', 'unknown', 'succeeded')
    ) then
        raise exception 'CHECKOUT_PAYMENT_STATUS_UNRESOLVED';
    end if;

    update public.products as products
    set
        status = 'available',
        reserved_order_id = null
    where products.status = 'reserved'
      and products.reserved_order_id = v_order.id;

    get diagnostics v_released_product_count = row_count;

    update public.orders as orders
    set
        status = 'cancelled',
        cancelled_at = coalesce(orders.cancelled_at, v_now)
    where orders.id = v_order.id
      and orders.status = 'pending_payment';

    if not found then
        raise exception 'CHECKOUT_SESSION_CLOSED';
    end if;

    return query
    select
        v_order.id,
        v_order.order_number,
        'cancelled'::text,
        v_released_product_count;
end;
$$;

revoke all on function public.cancel_guest_checkout(text, text)
from public, anon, authenticated;

grant execute on function public.cancel_guest_checkout(text, text)
to service_role;

commit;