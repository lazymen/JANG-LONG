-- JANG LONG
-- Return an active guest checkout without exposing customer contact or address data.

begin;

create function public.resume_guest_checkout(
    p_checkout_key_hash text,
    p_recovery_token_hash text
)
returns table (
    order_id uuid,
    order_number text,
    order_status text,
    subtotal integer,
    shipping_fee integer,
    total_amount integer,
    reservation_expires_at timestamp with time zone,
    order_items jsonb
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
      and orders.recovery_token_hash = v_recovery_token_hash;

    if not found then
        raise exception 'CHECKOUT_RECOVERY_NOT_FOUND';
    end if;

    if v_order.status = 'pending_payment'
       and v_order.reservation_expires_at <= v_now then
        raise exception 'CHECKOUT_RESERVATION_EXPIRED';
    end if;

    if v_order.status <> 'pending_payment' then
        raise exception 'CHECKOUT_SESSION_CLOSED';
    end if;

    return query
    select
        v_order.id,
        v_order.order_number,
        v_order.status,
        v_order.subtotal,
        v_order.shipping_fee,
        v_order.total_amount,
        v_order.reservation_expires_at,
        coalesce(
            (
                select jsonb_agg(
                    jsonb_build_object(
                        'product_id', items.product_id,
                        'product_name', items.product_name,
                        'size', items.size,
                        'unit_price', items.unit_price,
                        'image_path', items.image_path
                    )
                    order by items.product_id
                )
                from public.order_items as items
                where items.order_id = v_order.id
            ),
            '[]'::jsonb
        );
end;
$$;

comment on function public.resume_guest_checkout(text, text) is
'Private guest-checkout recovery lookup. Returns no customer contact or address data.';

revoke all on function public.resume_guest_checkout(text, text)
from public, anon, authenticated;

grant execute on function public.resume_guest_checkout(text, text)
to service_role;

commit;