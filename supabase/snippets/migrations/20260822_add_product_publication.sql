-- JANG LONG
-- Add a publication state without changing the existing sales state.

begin;

alter table public.products
    add column is_published boolean not null default false,
    add column published_at timestamp with time zone;

-- Preserve the current storefront: all existing products remain visible.
update public.products
set
    is_published = true,
    published_at = coalesce(published_at, created_at, now());

-- The operator only needs to toggle is_published in Table Editor.
-- The first publication time is recorded automatically and is preserved
-- when a product is unpublished and published again.
create function public.set_product_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.is_published = true and new.published_at is null then
        new.published_at = now();
    end if;

    return new;
end;
$$;

create trigger products_set_published_at
before insert or update of is_published, published_at
on public.products
for each row
execute function public.set_product_published_at();

alter table public.products
    add constraint products_published_at_check
    check (is_published = false or published_at is not null);

-- Anonymous browser requests can read published products only.
alter policy "products_public_read"
on public.products
to anon, authenticated
using (is_published = true);

-- Browser roles only need to read products. Table Editor uses an
-- administrative role and is not affected by these revocations.
revoke insert, update, delete, truncate, references, trigger
on table public.products
from anon, authenticated;

grant select
on table public.products
to anon, authenticated;

commit;