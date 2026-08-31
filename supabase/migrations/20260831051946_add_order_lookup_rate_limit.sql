create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

grant usage on schema private to service_role;

create table private.order_lookup_rate_limits (
    rate_key text primary key,
    window_started_at timestamp with time zone not null default now(),
    request_count integer not null default 1,
    updated_at timestamp with time zone not null default now(),

    constraint order_lookup_rate_limits_rate_key_check
        check (rate_key ~ '^[0-9a-f]{64}$'),

    constraint order_lookup_rate_limits_request_count_check
        check (request_count > 0)
);

create index order_lookup_rate_limits_updated_at_idx
on private.order_lookup_rate_limits (updated_at);

comment on table private.order_lookup_rate_limits is
    'Stores HMAC-hashed client identifiers for guest order lookup rate limiting. Raw IP addresses are never stored.';

alter table private.order_lookup_rate_limits
enable row level security;

revoke all
on table private.order_lookup_rate_limits
from public, anon, authenticated;

grant select, insert, update, delete
on table private.order_lookup_rate_limits
to service_role;


create or replace function public.consume_order_lookup_rate_limit(
    p_rate_key text,
    p_limit integer default 10,
    p_window_seconds integer default 600
)
returns table (
    is_allowed boolean,
    retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_now timestamp with time zone := clock_timestamp();
    v_window interval;
    v_request_count integer;
    v_window_started_at timestamp with time zone;
begin
    if p_rate_key is null
        or p_rate_key !~ '^[0-9a-f]{64}$'
    then
        raise exception 'Invalid rate-limit key'
            using errcode = '22023';
    end if;

    if p_limit < 1 or p_limit > 1000 then
        raise exception 'Invalid rate-limit request count'
            using errcode = '22023';
    end if;

    if p_window_seconds < 1
        or p_window_seconds > 86400
    then
        raise exception 'Invalid rate-limit window'
            using errcode = '22023';
    end if;

    v_window := make_interval(
        secs => p_window_seconds
    );

    insert into private.order_lookup_rate_limits as limits (
        rate_key,
        window_started_at,
        request_count,
        updated_at
    )
    values (
        p_rate_key,
        v_now,
        1,
        v_now
    )
    on conflict (rate_key)
    do update
    set
        request_count = case
            when limits.window_started_at + v_window <= v_now
                then 1
            else limits.request_count + 1
        end,

        window_started_at = case
            when limits.window_started_at + v_window <= v_now
                then v_now
            else limits.window_started_at
        end,

        updated_at = v_now
    returning
        request_count,
        window_started_at
    into
        v_request_count,
        v_window_started_at;

    return query
    select
        v_request_count <= p_limit,

        case
            when v_request_count <= p_limit
                then 0
            else greatest(
                1,
                ceil(
                    extract(
                        epoch from (
                            v_window_started_at
                            + v_window
                            - v_now
                        )
                    )
                )::integer
            )
        end;
end;
$$;

comment on function public.consume_order_lookup_rate_limit(
    text,
    integer,
    integer
) is
    'Atomically consumes one guest order lookup request and returns whether it is allowed and how many seconds remain.';

revoke all
on function public.consume_order_lookup_rate_limit(
    text,
    integer,
    integer
)
from public, anon, authenticated;

grant execute
on function public.consume_order_lookup_rate_limit(
    text,
    integer,
    integer
)
to service_role;


create or replace function public.cleanup_order_lookup_rate_limits(
    p_retention_days integer default 1
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_deleted_count integer;
begin
    if p_retention_days < 1
        or p_retention_days > 365
    then
        raise exception 'Invalid retention period'
            using errcode = '22023';
    end if;

    delete from private.order_lookup_rate_limits
    where updated_at
        < clock_timestamp()
        - make_interval(days => p_retention_days);

    get diagnostics v_deleted_count = row_count;

    return v_deleted_count;
end;
$$;

comment on function public.cleanup_order_lookup_rate_limits(
    integer
) is
    'Deletes inactive guest order lookup rate-limit records after the retention period.';

revoke all
on function public.cleanup_order_lookup_rate_limits(integer)
from public, anon, authenticated;

grant execute
on function public.cleanup_order_lookup_rate_limits(integer)
to service_role;


do $$
begin
    if not exists (
        select 1
        from cron.job
        where jobname =
            'janglong-clean-order-lookup-rate-limits'
    ) then
        perform cron.schedule(
            'janglong-clean-order-lookup-rate-limits',
            '17 18 * * *',
            'select public.cleanup_order_lookup_rate_limits(1);'
        );
    end if;
end;
$$;