import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";

type JsonObject = Record<string, unknown>;

class CheckoutError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
  ) {
    super(code);
  }
}

const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
const PRODUCT_ID_PATTERN = /^[0-9]{4}$/;

const FORBIDDEN_BROWSER_FIELDS = [
  "price",
  "subtotal",
  "shippingFee",
  "shipping_fee",
  "total",
  "totalAmount",
  "total_amount",
  "isRemoteArea",
  "is_remote_area",
  "status",
  "orderNumber",
  "order_number",
  "reservationMinutes",
];

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isJsonObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readRequiredString(
  body: JsonObject,
  key: string,
  maximumLength: number,
): string {
  const rawValue = body[key];

  if (typeof rawValue !== "string") {
    throw new CheckoutError(
      400,
      "INVALID_REQUEST",
      "입력 정보를 다시 확인해주세요.",
    );
  }

  const value = rawValue.trim();

  if (value === "" || value.length > maximumLength) {
    throw new CheckoutError(
      400,
      "INVALID_REQUEST",
      "입력 정보를 다시 확인해주세요.",
    );
  }

  return value;
}

function readOptionalString(
  body: JsonObject,
  key: string,
  maximumLength: number,
): string {
  const rawValue = body[key];

  if (rawValue === undefined || rawValue === null) {
    return "";
  }

  if (typeof rawValue !== "string") {
    throw new CheckoutError(
      400,
      "INVALID_REQUEST",
      "입력 정보를 다시 확인해주세요.",
    );
  }

  const value = rawValue.trim();

  if (value.length > maximumLength) {
    throw new CheckoutError(
      400,
      "INVALID_REQUEST",
      "입력 정보를 다시 확인해주세요.",
    );
  }

  return value;
}

function readToken(body: JsonObject, key: string): string {
  const token = readRequiredString(body, key, 64).toLowerCase();

  if (!TOKEN_PATTERN.test(token)) {
    throw new CheckoutError(
      400,
      "INVALID_CHECKOUT_TOKEN",
      "결제 준비 정보가 올바르지 않습니다. 장바구니에서 다시 시도해주세요.",
    );
  }

  return token;
}

function readProductIds(body: JsonObject): string[] {
  const rawProductIds = body.productIds;

  if (
    !Array.isArray(rawProductIds) ||
    rawProductIds.length === 0
  ) {
    throw new CheckoutError(
      400,
      "EMPTY_CART",
      "장바구니가 비어 있습니다.",
    );
  }

  const productIds = rawProductIds.map((rawProductId) => {
    if (typeof rawProductId !== "string") {
      throw new CheckoutError(
        400,
        "INVALID_PRODUCT_ID",
        "상품 정보를 다시 확인해주세요.",
      );
    }

    const productId = rawProductId.trim();

    if (!PRODUCT_ID_PATTERN.test(productId)) {
      throw new CheckoutError(
        400,
        "INVALID_PRODUCT_ID",
        "상품 정보를 다시 확인해주세요.",
      );
    }

    return productId;
  });

  if (new Set(productIds).size !== productIds.length) {
    throw new CheckoutError(
      400,
      "DUPLICATE_PRODUCT_ID",
      "장바구니에 같은 상품이 중복되어 있습니다.",
    );
  }

  return productIds;
}

async function sha256Hex(value: string): Promise<string> {
  const encodedValue = new TextEncoder().encode(value);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encodedValue,
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/*
 * 배송사가 정해지고 공식 도서산간 판정 기준이 준비되면
 * 이 함수만 실제 판정 기능으로 교체한다.
 *
 * 현재는 고객이 직접 true/false를 선택하거나,
 * 모든 주소를 false로 처리하지 않는다.
 */
function classifyRemoteArea(_postalCode: string): boolean {
  // 임시 운영 규칙: 배송사·우편번호 판별 기준이 확정되기 전에는
  // 모든 주소를 일반 지역으로 처리한다.
  // 실제 결제 연동 전에는 실제 분류기로 반드시 교체한다.
  return false;
}

function convertDatabaseError(message: string): CheckoutError {
  if (message.includes("CHECKOUT_PRODUCTS_UNAVAILABLE")) {
    return new CheckoutError(
      409,
      "CHECKOUT_PRODUCTS_UNAVAILABLE",
      "현재 선택하신 상품 중 구매할 수 없는 상품이 있습니다. 장바구니를 다시 확인해주세요.",
    );
  }

  if (message.includes("CHECKOUT_RESERVATION_EXPIRED")) {
    return new CheckoutError(
      410,
      "CHECKOUT_RESERVATION_EXPIRED",
      "결제 가능 시간이 만료되었습니다. 장바구니에서 다시 시도해주세요.",
    );
  }

  if (message.includes("CHECKOUT_SESSION_CLOSED")) {
    return new CheckoutError(
      409,
      "CHECKOUT_SESSION_CLOSED",
      "이미 종료된 결제입니다. 장바구니에서 다시 시도해주세요.",
    );
  }

  if (
    message.includes("CHECKOUT_KEY_REUSED_WITH_DIFFERENT_DATA") ||
    message.includes("CHECKOUT_RESERVATION_INCONSISTENT")
  ) {
    return new CheckoutError(
      409,
      "CHECKOUT_SESSION_CONFLICT",
      "결제 정보가 변경되었습니다. 장바구니에서 다시 시도해주세요.",
    );
  }

  return new CheckoutError(
    500,
    "CHECKOUT_FAILED",
    "주문을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.",
  );
}

export default {
  fetch: withSupabase(
    { auth: ["publishable"] },
    async (request, context) => {
      try {
        if (request.method !== "POST") {
          throw new CheckoutError(
            405,
            "METHOD_NOT_ALLOWED",
            "지원하지 않는 요청입니다.",
          );
        }

        let body: unknown;

        try {
          body = await request.json();
        } catch {
          throw new CheckoutError(
            400,
            "INVALID_JSON",
            "전송된 정보를 읽을 수 없습니다.",
          );
        }

        if (!isJsonObject(body)) {
          throw new CheckoutError(
            400,
            "INVALID_REQUEST",
            "입력 정보를 다시 확인해주세요.",
          );
        }

        if (
          FORBIDDEN_BROWSER_FIELDS.some((field) => Object.hasOwn(body, field))
        ) {
          throw new CheckoutError(
            400,
            "FORBIDDEN_CHECKOUT_FIELD",
            "브라우저에서 변경할 수 없는 주문 정보가 포함되어 있습니다.",
          );
        }

        const checkoutToken = readToken(body, "checkoutToken");
        const recoveryToken = readToken(body, "recoveryToken");

        const customerName = readRequiredString(body, "customerName", 80);

        const customerPhone = readRequiredString(body, "customerPhone", 20);

        const customerEmail = readRequiredString(body, "customerEmail", 120)
          .toLowerCase();

        const postalCode = readRequiredString(body, "postalCode", 20);

        const addressLine1 = readRequiredString(body, "addressLine1", 160);

        const addressLine2 = readOptionalString(body, "addressLine2", 160);

        const deliveryNote = readOptionalString(body, "deliveryNote", 300);

        const productIds = readProductIds(body);

        const checkoutKeyHash = await sha256Hex(checkoutToken);

        const recoveryTokenHash = await sha256Hex(recoveryToken);

        /*
         * 현재는 정확한 도서산간 판정 기준이 없으므로 여기서
         * 안전하게 중단된다. 배송사 결정 후 이 함수가 실제
         * true/false 값을 반환하면 아래 주문 처리가 이어진다.
         */
        const isRemoteArea = classifyRemoteArea(postalCode);

        const supabaseAdmin = context.supabaseAdmin as SupabaseClient<Database>;

        const { data, error } = await supabaseAdmin.rpc(
          "start_guest_checkout",
          {
            p_checkout_key_hash: checkoutKeyHash,
            p_recovery_token_hash: recoveryTokenHash,
            p_customer_name: customerName,
            p_customer_phone: customerPhone,
            p_customer_email: customerEmail,
            p_postal_code: postalCode,
            p_address_line1: addressLine1,
            p_address_line2: addressLine2,
            p_delivery_note: deliveryNote,
            p_product_ids: productIds,
            p_is_remote_area: isRemoteArea,
          },
        );

        if (error) {
          console.error("start_guest_checkout failed", {
            databaseCode: error.code,
          });

          throw convertDatabaseError(error.message);
        }

        const order = Array.isArray(data) ? data[0] : data;

        if (!order) {
          throw new CheckoutError(
            500,
            "EMPTY_CHECKOUT_RESULT",
            "주문 결과를 확인하지 못했습니다.",
          );
        }

        return jsonResponse({
          ok: true,
          order,
        });
      } catch (error) {
        if (error instanceof CheckoutError) {
          return jsonResponse(
            {
              ok: false,
              error: {
                code: error.code,
                message: error.publicMessage,
              },
            },
            error.status,
          );
        }

        console.error("Unexpected checkout error");

        return jsonResponse(
          {
            ok: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "주문을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.",
            },
          },
          500,
        );
      }
    },
  ),
};
