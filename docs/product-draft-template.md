# JANG LONG 상품 초안

## 기본 정보

```text
ID:
상품명:
가격:
사이즈:
원산지:
연대:
카테고리: tops / bottoms / outerwear
```

## 고객용 설명

```text
description:
```

## 고객용 컨디션·특이사항

한 줄당 한 항목. `\\n`을 쓰지 말고 실제 줄바꿈으로 작성한다. shift + enter

```text
notes:
-
-
-
```

## 실측

값만 입력한다. 단위 `cm`는 쓰지 않는다.

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

## 사진 준비

```text
대표사진: main.jpg
상세사진: 01.jpg, 02.jpg, 03.jpg
파일 형식: JPG
파일당 크기: 5MB 이하 / 목표 1MB 이하
Storage 폴더: product-images/{ID}/
```

## Table Editor 입력값

```text
status: available
is_published: FALSE
published_at: 비워 둠
```

```json
["{ID}/main.jpg", "{ID}/01.jpg", "{ID}/02.jpg"]
```

## 공개 전 확인

```text
[ ] Storage 사진이 모두 열림
[ ] SHOP에 아직 보이지 않음
[ ] 상품 정보·실측·컨디션 문구 검토 완료
```

## 공개

```text
is_published: TRUE
published_at: 공개하는 현재 시각
```

## 공개 후 확인

```text
[ ] SHOP 카드
[ ] 상품 상세·갤러리
[ ] SEARCH
[ ] CART
```
