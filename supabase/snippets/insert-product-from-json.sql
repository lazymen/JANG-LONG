-- JANG LONG
-- New product INSERT template
--
-- 사용 순서:
-- 1. 상품 이미지를 GitHub Pages에 먼저 배포한다.
-- 2. 이 파일 전체를 복사해서 Supabase SQL Editor의 새 Query에 붙여넣는다.
-- 3. __PASTE_PRODUCT_JSON_HERE__ 부분만 완성된 상품 JSON으로 교체한다.
-- 4. 신규 상품 ID가 중복되지 않았는지 확인한 후 실행한다.
--
-- 허용 category:
-- tops, bottoms, outerwear, accessories, footwear, other
--
-- 주의:
-- 이 파일 자체에는 실제 상품 데이터나 API key를 저장하지 않는다.
-- 기존 ID가 중복되면 덮어쓰지 않고 오류가 발생한다.

with product_input as (
    select $product$
__PASTE_PRODUCT_JSON_HERE__
    $product$::jsonb as data
)

insert into public.products (
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
    images
)

select
    data->>'id',
    data->>'name',
    (data->>'price')::integer,
    data->>'size',
    data->>'country',
    data->>'era',
    data->>'status',
    data->>'category',
    data->>'description',
    data->>'notes',
    data->'measurement',
    array(
        select jsonb_array_elements_text(data->'images')
    )
from product_input

returning
    id,
    name,
    price,
    status,
    created_at,
    updated_at;