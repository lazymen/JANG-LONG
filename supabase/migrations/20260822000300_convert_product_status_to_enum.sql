-- JANG LONG
-- Convert product status from free text to a fixed selectable enum.

begin;

create type public.product_status as enum (
    'available',
    'reserved',
    'gone'
    
);

alter table public.products
    drop constraint products_status_check,
    drop constraint products_reservation_link_check;

alter table public.products
    alter column status drop default;

alter table public.products
    alter column status type public.product_status
    using status::public.product_status;

alter table public.products
    alter column status
    set default 'available'::public.product_status;

alter table public.products
    add constraint products_reservation_link_check
    check (
        (status = 'reserved' and reserved_order_id is not null)
        or
        (status <> 'reserved' and reserved_order_id is null)
    );

commit;