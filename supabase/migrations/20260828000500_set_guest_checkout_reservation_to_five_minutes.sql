-- JANG LONG
-- Keep each guest checkout reservation to a fixed five-minute window.

begin;

create or replace function public.enforce_guest_checkout_reservation_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.status = 'pending_payment' then
        new.reservation_expires_at =
            new.reservation_started_at + interval '5 minutes';
    end if;

    return new;
end;
$$;

drop trigger if exists orders_enforce_guest_checkout_reservation_window
on public.orders;

create trigger orders_enforce_guest_checkout_reservation_window
before insert or update of status, reservation_started_at, reservation_expires_at
on public.orders
for each row
execute function public.enforce_guest_checkout_reservation_window();

update public.orders
set reservation_expires_at = reservation_started_at + interval '5 minutes'
where status = 'pending_payment';

commit;