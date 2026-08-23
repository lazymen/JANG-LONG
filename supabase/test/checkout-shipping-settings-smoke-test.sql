-- JANG LONG
-- Disposable smoke test for the provisional checkout shipping configuration.
--
-- It verifies permissions, threshold boundaries, remote-area surcharges, and
-- operator-editable values. Every test change is rolled back at the end.

begin;

do $$
declare
    v_settings public.checkout_shipping_settings%rowtype;
    v_expected_error_seen boolean := false;
begin
    if has_table_privilege(
        'anon',
        'public.checkout_shipping_settings',
        'SELECT'
    ) then
        raise exception 'Anonymous role can read private shipping settings';
    end if;

    if has_table_privilege(
        'authenticated',
        'public.checkout_shipping_settings',
        'SELECT'
    ) then
        raise exception 'Authenticated role can read private shipping settings';
    end if;

    if has_function_privilege(
        'anon',
        'public.calculate_checkout_shipping_fee(integer,boolean)',
        'EXECUTE'
    ) then
        raise exception 'Anonymous role can execute the private shipping calculator';
    end if;

    if has_function_privilege(
        'authenticated',
        'public.calculate_checkout_shipping_fee(integer,boolean)',
        'EXECUTE'
    ) then
        raise exception 'Authenticated role can execute the private shipping calculator';
    end if;

    select settings.*
    into v_settings
    from public.checkout_shipping_settings as settings
    where settings.id = 1;

    if not found
       or v_settings.base_shipping_fee <> 3000
       or v_settings.free_shipping_threshold <> 100000
       or v_settings.remote_area_surcharge <> 5000
       or v_settings.is_provisional is not true then
        raise exception 'Initial provisional shipping settings are incorrect';
    end if;

    -- General area: KRW 3,000 below the threshold, free at the threshold.
    if public.calculate_checkout_shipping_fee(99999, false) <> 3000
       or public.calculate_checkout_shipping_fee(100000, false) <> 0 then
        raise exception 'General-area shipping calculation failed';
    end if;

    -- Remote area: the KRW 5,000 surcharge is added separately. Free base
    -- shipping removes only the KRW 3,000 base fee.
    if public.calculate_checkout_shipping_fee(99999, true) <> 8000
       or public.calculate_checkout_shipping_fee(100000, true) <> 5000 then
        raise exception 'Remote-area shipping calculation failed';
    end if;

    -- Invalid money input must never silently become a real order amount.
    begin
        perform public.calculate_checkout_shipping_fee(-1, false);
    exception
        when others then
            if sqlerrm = 'INVALID_SUBTOTAL' then
                v_expected_error_seen := true;
            else
                raise;
            end if;
    end;

    if v_expected_error_seen is not true then
        raise exception 'Negative subtotal did not fail';
    end if;

    -- Simulate a later operator change. The calculator must use the new row
    -- values without any HTML, JavaScript, or function rewrite.
    update public.checkout_shipping_settings
    set
        base_shipping_fee = 4000,
        free_shipping_threshold = 120000,
        remote_area_surcharge = 6000
    where id = 1;

    if public.calculate_checkout_shipping_fee(119999, true) <> 10000
       or public.calculate_checkout_shipping_fee(120000, true) <> 6000 then
        raise exception 'Updated shipping settings were not applied';
    end if;
end;
$$;

rollback;

select
    'PASS: checkout shipping settings verified; all test changes rolled back' as result;