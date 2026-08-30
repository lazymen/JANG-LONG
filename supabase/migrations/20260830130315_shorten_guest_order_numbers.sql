create sequence public.guest_order_number_seq
    as bigint
    increment by 1
    minvalue 1
    start with 1
    no maxvalue
    cache 1;

select pg_catalog.setval(
    'public.guest_order_number_seq'::regclass,
    coalesce(
        (
            select
                max(substring(orders.order_number from 4)::bigint) + 1
            from public.orders as orders
            where orders.order_number ~ '^JL-[0-9]{6,}$'
        ),
        1
    ),
    false
);

revoke all
on sequence public.guest_order_number_seq
from public, anon, authenticated;

grant usage, select
on sequence public.guest_order_number_seq
to service_role;

comment on sequence public.guest_order_number_seq is
    'Generates customer-facing sequential guest order numbers. Sequence gaps are expected and numbers must never be reused.';

create or replace function public.assign_guest_order_number()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    new.order_number :=
        'JL-' ||
        pg_catalog.lpad(
            pg_catalog.nextval(
                'public.guest_order_number_seq'::regclass
            )::text,
            6,
            '0'
        );

    return new;
end;
$function$;

revoke execute
on function public.assign_guest_order_number()
from public, anon, authenticated;

drop trigger if exists orders_assign_guest_order_number
on public.orders;

create trigger orders_assign_guest_order_number
before insert on public.orders
for each row
execute function public.assign_guest_order_number();

comment on trigger orders_assign_guest_order_number
on public.orders is
    'Assigns JL-000001 style customer-facing numbers to new orders.';

alter table public.orders
add constraint orders_order_number_supported_format_check
check (
    order_number ~ '^JL-([0-9]{6,}|[0-9A-F]{32})$'
)
not valid;

alter table public.orders
validate constraint orders_order_number_supported_format_check;