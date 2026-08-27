-- JANG LONG
-- Automatically release expired, unpaid guest-checkout reservations.

begin;

create extension if not exists pg_cron;

do $$
declare
    existing_job_id bigint;
begin
    select jobid
    into existing_job_id
    from cron.job
    where jobname = 'janglong-expire-guest-checkouts';

    if existing_job_id is not null then
        perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
        'janglong-expire-guest-checkouts',
        '* * * * *',
        $job$select public.expire_guest_checkouts(100);$job$
    );
end;
$$;

commit;