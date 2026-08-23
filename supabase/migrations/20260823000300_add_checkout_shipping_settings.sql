-- JANG LONG
-- Add one private source of truth for provisional checkout shipping rules.
--
-- Current provisional policy:
--   * base domestic shipping fee: KRW 3,000
--   * free base shipping at product subtotal KRW 100,000 or more
--   * remote-area surcharge: KRW 5,000
--
-- The remote-area surcharge is added separately and is not removed by the
-- free-base-shipping threshold. All values remain editable by the operator in
-- Table Editor after the carrier and real product price range are confirmed.
--
-- This migration does not connect shipping calculation to the storefront or
-- to public.start_guest_checkout(). That connection belongs to the later
-- trusted-backend and address-classification step.

begin;

create table public.checkout_shipping_settings (
    id smallint primary key default 1,

    base_shipping_fee integer not null,
    free_shipping_threshold integer not null,
    remote_area_surcharge integer not null,

    is_provisional boolean not null default true,

    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint checkout_shipping_settings_single_row
        check (id = 1),

    constraint checkout_shipping_settings_base_fee_nonnegative
        check (base_shipping_fee >= 0),

    constraint checkout_shipping_settings_threshold_positive
        check (free_shipping_threshold > 0),

    constraint checkout_shipping_settings_remote_surcharge_nonnegative
        check (remote_area_surcharge >= 0)
);

comment on table public.checkout_shipping_settings is
'Private, single-row checkout shipping configuration. Current values are provisional until the carrier and catalog price range are confirmed.';

comment on column public.checkout_shipping_settings.base_shipping_fee is
'Base domestic shipping fee in KRW.';

comment on column public.checkout_shipping_settings.free_shipping_threshold is
'Product subtotal in KRW at which only the base shipping fee becomes free.';

comment on column public.checkout_shipping_settings.remote_area_surcharge is
'Additional remote-area charge in KRW. It remains payable even when base shipping is free.';

comment on column public.checkout_shipping_settings.is_provisional is
'True while the carrier and final shipping prices are not confirmed.';

create trigger checkout_shipping_settings_set_updated_at
before update on public.checkout_shipping_settings
for each row
execute function public.set_updated_at();

insert into public.checkout_shipping_settings (
    id,
    base_shipping_fee,
    free_shipping_threshold,
    remote_area_surcharge,
    is_provisional
)
values (
    1,
    3000,
    100000,
    5000,
    true
);


create or replace function public.calculate_checkout_shipping_fee(
    p_subtotal integer,
    p_is_remote_area boolean
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_base_shipping_fee integer;
    v_free_shipping_threshold integer;
    v_remote_area_surcharge integer;
    v_shipping_fee integer;
begin
    if p_subtotal is null or p_subtotal < 0 then
        raise exception 'INVALID_SUBTOTAL';
    end if;

    if p_is_remote_area is null then
        raise exception 'INVALID_REMOTE_AREA_STATE';
    end if;

    select
        settings.base_shipping_fee,
        settings.free_shipping_threshold,
        settings.remote_area_surcharge
    into
        v_base_shipping_fee,
        v_free_shipping_threshold,
        v_remote_area_surcharge
    from public.checkout_shipping_settings as settings
    where settings.id = 1;

    if not found then
        raise exception 'SHIPPING_SETTINGS_MISSING';
    end if;

    v_shipping_fee :=
        case
            when p_subtotal >= v_free_shipping_threshold then 0
            else v_base_shipping_fee
        end;

    if p_is_remote_area then
        v_shipping_fee :=
            v_shipping_fee + v_remote_area_surcharge;
    end if;

    return v_shipping_fee;
end;
$$;

comment on function public.calculate_checkout_shipping_fee(integer, boolean) is
'Private server-side shipping calculator. Remote-area classification must come from a trusted backend later.';


alter table public.checkout_shipping_settings enable row level security;

revoke all
on table public.checkout_shipping_settings
from anon, authenticated;

grant select
on table public.checkout_shipping_settings
to service_role;

revoke all on function public.calculate_checkout_shipping_fee(integer, boolean)
from public, anon, authenticated;

grant execute on function public.calculate_checkout_shipping_fee(integer, boolean)
to service_role;

commit;