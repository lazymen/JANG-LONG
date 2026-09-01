# JANG LONG 상품 등록 매뉴얼

## 운영 원칙

- 상품 정보는 Supabase Table Editor가 기준이다.
- 상품 사진은 Supabase Storage의 `product-images` 버킷이 기준이다.
- 일반 상품 등록과 수정에는 코드 수정, Git 커밋, SQL이 필요 없다.
- 새 상품은 비공개 초안으로 검수한 뒤에만 공개한다.
- 실제 공개 또는 주문 이력이 생긴 상품 ID는 재사용하지 않는다. 현재 다음 실제 상품 ID는 `0009`이다.
## 1. 사진 준비

1. 원본 사진은 별도 보관하고, 업로드용 복사본만 사용한다.
2. 파일 형식은 JPG만 사용한다.
3. 파일당 최대 5MB, 실무 목표는 1MB 이하로 맞춘다.
4. 대표사진은 `main.jpg`로 정한다.
5. 나머지 사진은 `01.jpg`, `02.jpg` 순서로 이름을 붙인다.

예시:

```text
main.jpg
01.jpg
02.jpg
03.jpg
```

## 2. Storage 업로드

1. Supabase Dashboard → Storage → `product-images`로 이동한다.
2. 상품 ID와 같은 새 폴더를 만든다. 예: `0009`
3. 폴더 안에 `main.jpg`, `01.jpg` 등을 업로드한다.
4. 파일 목록과 이름을 확인한다.

경로 규칙:

```text
product-images/0009/main.jpg
product-images/0009/01.jpg
```

> `product-images`는 public 버킷이다. 상품을 비공개로 등록해도 사진 URL을 아는 사람은 사진을 볼 수 있으므로, 공개 전 민감한 사진은 올리지 않는다.

## 3. Table Editor에 비공개 초안 등록

Supabase Dashboard → Table Editor → `products` → Insert

| 필드 | 입력 규칙 |
| --- | --- |
| `id` | 네 자리 숫자 상품 ID. 예: `0009` |
| `name` | 고객에게 보일 상품명 |
| `price` | 원화 정수. 쉼표 없이 입력. 예: `129000` |
| `size` | 실제 표기 사이즈. 예: `L`, `32` |
| `country` | 확인된 원산지. 예: `Made in USA` |
| `era` | 확인된 연대. 예: `1970s`; 모르면 빈 값 |
| `status` | 신규 상품은 항상 `available` |
| `category` | 현재 사용 분류 중 하나: `tops`, `bottoms`, `outerwear` |
| `description` | 상품의 핵심 설명 |
| `notes` | 고객용 컨디션·특이사항. 한 줄당 한 항목 |
| `measurement` | 아래 치수 객체 형식을 유지하고 값만 입력 |
| `images` | Storage 상대경로 배열. `main.jpg`가 반드시 첫 번째 |
| `is_published` | 초안에서는 `FALSE` |
| `published_at` | 초안에서는 비워 둠 |

다음 필드는 수동으로 건드리지 않는다.

```text
created_at
updated_at
reserved_order_id
```

### notes 줄바꿈

`\\n` 문자를 직접 입력하지 않는다. 실제 줄바꿈을 사용한다.

```text
Natural fading throughout.
Small repair on right sleeve.
```

Table Editor에서 이미 저장된 행을 직접 수정할 때는 `Shift + Enter`가 줄바꿈이고, `Enter`는 저장이다.

### measurement 기본 형식

값은 숫자도 문자열로 입력하고, 단위 `cm`는 쓰지 않는다. 사용하지 않는 치수는 빈 문자열 `""`로 둔다.

```json
{
  "shoulder": "",
  "chest": "",
  "length": "",
  "sleeve": "",
  "waist": "",
  "rise": "",
  "thigh": "",
  "hem": "",
  "inseam": "",
  "width": "",
  "height": "",
  "depth": ""
}
```

### images 입력 형식

```json
["0009/main.jpg", "0009/01.jpg", "0009/02.jpg"]
```

## 4. 비공개 초안 검수

1. Table Editor에서 저장된 값과 이미지 배열을 다시 확인한다.
2. 새 탭에서 대표사진과 상세사진 URL이 열리는지 확인한다.

```text
https://fdjzdjeqclkcssxrwnrk.supabase.co/storage/v1/object/public/product-images/0009/main.jpg
```

3. 공개 `SHOP`을 강력 새로고침한다.
4. 초안 상품이 SHOP에 보이지 않는지 확인한다.

## 5. 공개

초안 검수가 끝난 뒤에만 다음 두 값을 함께 수정하고 저장한다.

```text
is_published: TRUE
published_at: 공개하는 현재 시각
```

## 6. 공개 후 검수

공개 사이트에서 강력 새로고침 후 확인한다.

1. SHOP에 상품 카드가 보이는가
2. 대표사진이 맞는가
3. 상품 상세의 갤러리 사진이 모두 열리는가
4. SEARCH에서 상품이 검색되는가
5. CART에 정상적으로 담기는가

상품 등록 검수에서는 예약·결제를 새로 시작하지 않는다.

## 7. 판매 완료 또는 폐기

- 판매 완료 상품은 `is_published = TRUE`를 유지하고 `status`만 `gone`으로 변경한다.
- 주문·예약·판매 이력이 있는 상품은 DB 행이나 Storage 사진을 삭제하지 않는다.
- 한 번도 공개·주문되지 않은 연습 초안만 삭제할 수 있다.
- 연습 초안 삭제 순서: Table Editor의 상품 행 삭제 → Storage의 같은 ID 폴더 사진 삭제.
