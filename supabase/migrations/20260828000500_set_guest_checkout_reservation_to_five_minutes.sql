-- JANG LONG
-- Keep guest checkout reservations short and non-extendable.

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

comment on function public.enforce_guest_checkout_reservation_window() is
'Enforces a fixed five-minute pending-payment reservation.';

-- Existing pending reservations also follow the new customer-facing rule.
-- Paid, cancelled, and expired orders are untouched.
update public.orders
set reservation_expires_at = reservation_started_at + interval '5 minutes'
where status = 'pending_payment'
  and reservation_expires_at > reservation_started_at + interval '5 minutes';

-- Release anything that is already expired under the new rule.
select public.expire_guest_checkouts(100);

commit;