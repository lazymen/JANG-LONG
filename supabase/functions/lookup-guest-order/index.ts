import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";
import type { Database } from "../../database.types.ts";

type JsonObject = Record<string, unknown>;

class OrderLookupError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
  }
}

const ORDER_NUMBER_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_SECRET_NAME = "ORDER_LOOKUP_RATE_LIMIT_SECRET";
const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 600;
const MINIMUM_SECRET_LENGTH = 32;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  additionalHeaders: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...additionalHeaders,
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

function readOrderNumber(body: JsonObject): string {
  const rawValue = body.orderNumber;

  if (typeof rawValue !== "string") {
    throw new OrderLookupError(
      400,
      "INVALID_ORDER_NUMBER",
      "주문번호를 확인해주세요.",
    );
  }

  const orderNumber = rawValue.trim().toUpperCase();

  if (
    orderNumber.length < 8 ||
    orderNumber.length > 100 ||
    !ORDER_NUMBER_PATTERN.test(orderNumber)
  ) {
    throw new OrderLookupError(
      400,
      "INVALID_ORDER_NUMBER",
      "주문번호를 확인해주세요.",
    );
  }

  return orderNumber;
}

function readEmail(body: JsonObject): string {
  const rawValue = body.email;

  if (typeof rawValue !== "string") {
    throw new OrderLookupError(
      400,
      "INVALID_EMAIL",
      "이메일 주소를 확인해주세요.",
    );
  }

  const email = rawValue.trim().toLowerCase();

  if (
    email.length > 254 ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw new OrderLookupError(
      400,
      "INVALID_EMAIL",
      "이메일 주소를 확인해주세요.",
    );
  }

  return email;
}

function notFoundError(): OrderLookupError {
  return new OrderLookupError(
    404,
    "ORDER_NOT_FOUND",
    "주문번호 또는 이메일을 확인해주세요.",
  );
}

function readClientIp(request: Request): string {
  const clientIp = (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    ""
  ).trim();

  if (
    !clientIp ||
    clientIp.length > 64 ||
    clientIp.includes(",") ||
    /\s/.test(clientIp)
  ) {
    throw new OrderLookupError(
      503,
      "RATE_LIMIT_UNAVAILABLE",
      "주문조회 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  }

  return clientIp;
}

async function createRateKey(clientIp: string): Promise<string> {
  const secret = Deno.env.get(RATE_LIMIT_SECRET_NAME) ?? "";

  if (secret.length < MINIMUM_SECRET_LENGTH) {
    console.error("guest order lookup rate limit unavailable", {
      reason: "missing_or_short_secret",
    });

    throw new OrderLookupError(
      503,
      "RATE_LIMIT_UNAVAILABLE",
      "주문조회 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  }

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(clientIp),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatRetryAfter(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0 && remainingSeconds > 0) {
    return `${minutes}분 ${remainingSeconds}초`;
  }

  if (minutes > 0) {
    return `${minutes}분`;
  }

  return `${remainingSeconds}초`;
}

async function enforceRateLimit(
  request: Request,
  supabaseAdmin: SupabaseClient<Database>,
): Promise<void> {
  const clientIp = readClientIp(request);
  const rateKey = await createRateKey(clientIp);

  const { data, error } = await supabaseAdmin.rpc(
    "consume_order_lookup_rate_limit",
    {
      p_rate_key: rateKey,
      p_limit: RATE_LIMIT_REQUESTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    },
  );

  if (error) {
    console.error("guest order lookup rate limit failed", {
      databaseCode: error.code,
    });

    throw new OrderLookupError(
      503,
      "RATE_LIMIT_UNAVAILABLE",
      "주문조회 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  }

  const rateLimit = data?.[0];

  if (
    !rateLimit ||
    typeof rateLimit.is_allowed !== "boolean" ||
    typeof rateLimit.retry_after_seconds !== "number"
  ) {
    console.error("guest order lookup rate limit failed", {
      reason: "invalid_database_response",
    });

    throw new OrderLookupError(
      503,
      "RATE_LIMIT_UNAVAILABLE",
      "주문조회 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  }

  if (rateLimit.is_allowed) {
    return;
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.min(
      RATE_LIMIT_WINDOW_SECONDS,
      Math.ceil(rateLimit.retry_after_seconds),
    ),
  );

  throw new OrderLookupError(
    429,
    "TOO_MANY_REQUESTS",
    `요청이 너무 많습니다. ${formatRetryAfter(retryAfterSeconds)} 후 다시 시도해주세요.`,
    retryAfterSeconds,
  );
}

export default {
  fetch: withSupabase(
    { auth: ["publishable"] },
    async (request, context) => {
      try {
        if (request.method !== "POST") {
          throw new OrderLookupError(
            405,
            "METHOD_NOT_ALLOWED",
            "지원하지 않는 요청입니다.",
          );
        }

        const supabaseAdmin =
          context.supabaseAdmin as SupabaseClient<Database>;

        await enforceRateLimit(request, supabaseAdmin);

        let body: unknown;

        try {
          body = await request.json();
        } catch {
          throw new OrderLookupError(
            400,
            "INVALID_JSON",
            "전송된 정보를 읽을 수 없습니다.",
          );
        }

        if (!isJsonObject(body)) {
          throw new OrderLookupError(
            400,
            "INVALID_REQUEST",
            "입력 정보를 다시 확인해주세요.",
          );
        }

        const orderNumber = readOrderNumber(body);
        const email = readEmail(body);

        const { data: order, error: orderError } =
          await supabaseAdmin
            .from("orders")
            .select(`
                            id,
                            order_number,
                            customer_email,
                            customer_name,
                            postal_code,
                            address_line1,
                            address_line2,
                            delivery_note,
                            currency,
                            status,
                            subtotal,
                            shipping_fee,
                            total_amount,
                            shipping_status,
                            carrier,
                            tracking_number,
                            created_at,
                            paid_at,
                            cancelled_at,
                            refunded_at,
                            shipped_at,
                            delivered_at
                        `)
            .eq("order_number", orderNumber)
            .maybeSingle();

        if (orderError) {
          console.error("guest order lookup failed", {
            databaseCode: orderError.code,
          });

          throw new OrderLookupError(
            500,
            "ORDER_LOOKUP_FAILED",
            "주문 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
          );
        }

        // 이메일은 DB에서 고객에게 반환하지 않고 서버에서만 대조한다.
        if (
          !order ||
          order.customer_email.trim().toLowerCase() !== email
        ) {
          throw notFoundError();
        }

        const { data: items, error: itemsError } =
          await supabaseAdmin
            .from("order_items")
            .select(`
                            image_path,
                            product_name,
                            size,
                            unit_price
                        `)
            .eq("order_id", order.id)
            .order("created_at", {
              ascending: true,
            });

        if (itemsError) {
          console.error("guest order item lookup failed", {
            databaseCode: itemsError.code,
          });

          throw new OrderLookupError(
            500,
            "ORDER_LOOKUP_FAILED",
            "주문 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
          );
        }

        return jsonResponse({
          ok: true,
          order: {
            orderNumber: order.order_number,
            orderedAt: order.created_at,
            status: order.status,
            cancelledAt: order.cancelled_at,
            paidAt: order.paid_at,
            refundedAt: order.refunded_at,
            totals: {
              currency: order.currency,
              subtotal: order.subtotal,
              shippingFee: order.shipping_fee,
              totalAmount: order.total_amount,
            },
            shipping: {
              status: order.shipping_status,
              carrier: order.carrier,
              trackingNumber: order.tracking_number,
              shippedAt: order.shipped_at,
              deliveredAt: order.delivered_at,
              recipientName: order.customer_name,
              postalCode: order.postal_code,
              addressLine1: order.address_line1,
              addressLine2: order.address_line2,
              deliveryNote: order.delivery_note,
            },
            items: (items ?? []).map((item) => ({
              imagePath: item.image_path,
              productName: item.product_name,
              size: item.size,
              unitPrice: item.unit_price,
            })),
          },
        });
      } catch (error) {
        if (error instanceof OrderLookupError) {
          const errorBody: Record<string, unknown> = {
            code: error.code,
            message: error.publicMessage,
          };
          const responseHeaders: Record<string, string> = {};

          if (error.retryAfterSeconds !== null) {
            errorBody.retryAfterSeconds = error.retryAfterSeconds;
            responseHeaders["Retry-After"] = String(
              error.retryAfterSeconds,
            );
          }

          return jsonResponse(
            {
              ok: false,
              error: errorBody,
            },
            error.status,
            responseHeaders,
          );
        }

        console.error("Unexpected guest order lookup error");

        return jsonResponse(
          {
            ok: false,
            error: {
              code: "INTERNAL_ERROR",
              message:
                "주문 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
            },
          },
          500,
        );
      }
    },
  ),
};
