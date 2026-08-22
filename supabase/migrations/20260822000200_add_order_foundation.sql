-- JANG LONG
-- Add the guest order, order item, payment attempt, and reservation foundation.

begin;

create table public.orders (
    id uuid primary key default gen_random_uuid(),

    order_number text not null unique,
    checkout_key_hash text not null unique,
    recovery_token_hash text not null unique,

    status text not null default 'pending_payment',

    customer_name text not null,
    customer_phone text not null,
    customer_email text not null,

    postal_code text not null,
    address_line1 text not null,
    address_line2 text not null default '',
    delivery_note text not null default '',

    subtotal integer not null,
    shipping_fee integer not null default 0,
    total_amount integer generated always as (subtotal + shipping_fee) stored,
    currency text not null default 'KRW',

    reservation_started_at timestamp with time zone not null default now(),
    reservation_expires_at timestamp with time zone not null,

    shipping_status text not null default 'unfulfilled',
    carrier text,
    tracking_number text,

    paid_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    expired_at timestamp with time zone,
    refunded_at timestamp with time zone,
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone,

    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint orders_order_number_not_empty
        check (btrim(order_number) <> ''),

    constraint orders_checkout_key_hash_not_empty
        check (btrim(checkout_key_hash) <> ''),

    constraint orders_recovery_token_hash_not_empty
        check (btrim(recovery_token_hash) <> ''),

    constraint orders_customer_name_not_empty
        check (btrim(customer_name) <> ''),

    constraint orders_customer_phone_not_empty
        check (btrim(customer_phone) <> ''),

    constraint orders_customer_email_not_empty
        check (btrim(customer_email) <> ''),

    constraint orders_postal_code_not_empty
        check (btrim(postal_code) <> ''),

    constraint orders_address_line1_not_empty
        check (btrim(address_line1) <> ''),

    constraint orders_subtotal_positive
        check (subtotal > 0),

    constraint orders_shipping_fee_nonnegative
        check (shipping_fee >= 0),

    constraint orders_currency_krw
        check (currency = 'KRW'),

    constraint orders_reservation_time_valid
        check (reservation_expires_at > reservation_started_at),

    constraint orders_status_check
        check (
            status in (
                'pending_payment',
                'paid',
                'cancelled',
                'expired',
                'refunded'
            )
        ),

    constraint orders_shipping_status_check
        check (
            shipping_status in (
                'unfulfilled',
                'preparing',
                'shipped',
                'delivered',
                'returned'
            )
        )
);

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();


create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id),
    product_id text not null references public.products(id),

    product_name text not null,
    unit_price integer not null,
    size text not null default '',
    image_path text not null,

    created_at timestamp with time zone not null default now(),

    constraint order_items_order_product_unique
        unique (order_id, product_id),

    constraint order_items_product_name_not_empty
        check (btrim(product_name) <> ''),

    constraint order_items_unit_price_positive
        check (unit_price > 0),

    constraint order_items_image_path_not_empty
        check (btrim(image_path) <> '')
);


create table public.payment_attempts (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id),

    attempt_number integer not null,
    request_key_hash text not null unique,
    provider text not null default 'mock',
    provider_payment_id text,

    amount integer not null,
    status text not null default 'pending',
    failure_code text,
    failure_message text,

    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint payment_attempts_order_attempt_unique
        unique (order_id, attempt_number),

    constraint payment_attempts_attempt_number_positive
        check (attempt_number > 0),

    constraint payment_attempts_request_key_hash_not_empty
        check (btrim(request_key_hash) <> ''),

    constraint payment_attempts_provider_not_empty
        check (btrim(provider) <> ''),

    constraint payment_attempts_amount_positive
        check (amount > 0),

    constraint payment_attempts_status_check
        check (
            status in (
                'pending',
                'succeeded',
                'failed',
                'cancelled',
                'unknown'
            )
        )
);

create trigger payment_attempts_set_updated_at
before update on public.payment_attempts
for each row
execute function public.set_updated_at();


alter table public.products
    drop constraint products_status_check;

alter table public.products
    add column reserved_order_id uuid references public.orders(id),
    add constraint products_status_check
        check (status in ('available', 'reserved', 'gone')),
    add constraint products_reservation_link_check
        check (
            (status = 'reserved' and reserved_order_id is not null)
            or
            (status <> 'reserved' and reserved_order_id is null)
        );


create index orders_pending_reservation_expiry_idx
on public.orders (reservation_expires_at)
where status = 'pending_payment';

create index order_items_order_id_idx
on public.order_items (order_id);

create index payment_attempts_order_id_idx
on public.payment_attempts (order_id);

create unique index payment_attempts_provider_payment_id_key
on public.payment_attempts (provider, provider_payment_id)
where provider_payment_id is not null;

create index products_reserved_order_id_idx
on public.products (reserved_order_id)
where reserved_order_id is not null;


alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_attempts enable row level security;

revoke all
on table public.orders, public.order_items, public.payment_attempts
from anon, authenticated;

grant select, insert, update
on table public.orders, public.payment_attempts
to service_role;

grant select, insert
on table public.order_items
to service_role;


-- Keep internal reservation links out of the public Products API.
revoke select
on table public.products
from anon, authenticated;

grant select (
    id,
    name,
    price,
    size,
    country,
    era,
    status,
    category,
    description,
    notes,
    measurement,
    images,
    is_published,
    published_at
)
on table public.products
to anon, authenticated;

commit;