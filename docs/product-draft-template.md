JANG LONG — Table Editor 복사용 필드 템플릿

상품 전체를 JSON으로 등록하는 파일이 아니다. Supabase Table Editor의 images와 measurement 칸에 복사해 넣는 작업용 표준문이다.

사용 원칙

Storage 업로드가 먼저다: product-images/상품번호/파일명.

images에는 전체 URL이 아닌 짧은 경로만 넣는다.

main.jpg는 항상 첫 번째다.

measurement는 품목용 문장을 복사한 뒤, 대괄호 부분을 실제 실측값으로 전부 바꾼다.

실측값의 단위 표기 방식은 실제 상세 페이지 표기를 확인해 확정한다. 그 전에는 기존 상품과 같은 숫자 문자열 형식을 유지한다.

[WAIST] 같은 대괄호 문구가 하나라도 남아 있으면 저장하지 않는다.

images (text[])

사진 1장

["[ID]/main.jpg"]

사진 2장

["[ID]/main.jpg","[ID]/01.jpg"]

사진 3장

["[ID]/main.jpg","[ID]/01.jpg","[ID]/02.jpg"]

사진 4장

["[ID]/main.jpg","[ID]/01.jpg","[ID]/02.jpg","[ID]/03.jpg"]

사진 5장

["[ID]/main.jpg","[ID]/01.jpg","[ID]/02.jpg","[ID]/03.jpg","[ID]/04.jpg"]

사진 6장

["[ID]/main.jpg","[ID]/01.jpg","[ID]/02.jpg","[ID]/03.jpg","[ID]/04.jpg","[ID]/05.jpg"]

예시 — 상품 0009, 사진 3장

["0009/main.jpg","0009/01.jpg","0009/02.jpg"]

measurement (jsonb)

모든 템플릿은 현재 JANG LONG 측정 키를 모두 유지한다. 해당하지 않는 항목은 빈 문자열 ""로 둔다.

상의 · 니트 · 셔츠 · 스웨트 · 아우터

{"shoulder":"[SHOULDER]","chest":"[CHEST]","length":"[LENGTH]","sleeve":"[SLEEVE]","waist":"","rise":"","thigh":"","hem":"[HEM]","inseam":"","width":"","height":"","depth":""}

하의 · 데님 · 팬츠 · 쇼츠

{"shoulder":"","chest":"","length":"","sleeve":"","waist":"[WAIST]","rise":"[RISE]","thigh":"[THIGH]","hem":"[HEM]","inseam":"[INSEAM]","width":"","height":"","depth":""}

가방 · 소품

{"shoulder":"","chest":"","length":"","sleeve":"","waist":"","rise":"","thigh":"","hem":"","inseam":"","width":"[WIDTH]","height":"[HEIGHT]","depth":"[DEPTH]"}

실측값을 넣은 하의 예시

{"shoulder":"","chest":"","length":"","sleeve":"","waist":"40","rise":"31","thigh":"32","hem":"22","inseam":"76","width":"","height":"","depth":""}

저장 전 15초 검수

images의 상품번호와 Storage 폴더 번호가 같은가?

images의 첫 항목이 main.jpg인가?

배열의 사진 수와 실제 업로드 수가 같은가?

measurement의 대괄호 임시문구를 모두 실제 값으로 바꿨는가?

실제로 재지 않은 값은 넣지 않았는가?

초안이면 is_published = FALSE, published_at은 비어 있는가?