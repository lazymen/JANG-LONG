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

function readToken(body: JsonObject, key: string): string {
    const rawValue = body[key];

    if (typeof rawValue !== "string") {
        throw new CheckoutError(
            400,
            "INVALID_CHECKOUT_TOKEN",
            "결제 준비 정보가 올바르지 않습니다. 장바구니에서 다시 시도해주세요.",
        );
    }

    const token = rawValue.trim().toLowerCase();

    if (!TOKEN_PATTERN.test(token)) {
        throw new CheckoutError(
            400,
            "INVALID_CHECKOUT_TOKEN",
            "결제 준비 정보가 올바르지 않습니다. 장바구니에서 다시 시도해주세요.",
        );
    }

    return token;
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

function convertDatabaseError(message: string): CheckoutError {
    if (message.includes("CHECKOUT_RECOVERY_NOT_FOUND")) {
        return new CheckoutError(
            404,
            "CHECKOUT_RECOVERY_NOT_FOUND",
            "진행 중인 예약을 찾지 못했습니다. 장바구니에서 다시 시도해주세요.",
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

    return new CheckoutError(
        500,
        "CHECKOUT_RESUME_FAILED",
        "예약 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
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

                const checkoutToken = readToken(
                    body,
                    "checkoutToken",
                );

                const recoveryToken = readToken(
                    body,
                    "recoveryToken",
                );

                const supabaseAdmin =
                    context.supabaseAdmin as SupabaseClient<Database>;

                const { data, error } = await supabaseAdmin.rpc(
                    "resume_guest_checkout",
                    {
                        p_checkout_key_hash: await sha256Hex(checkoutToken),
                        p_recovery_token_hash: await sha256Hex(recoveryToken),
                    },
                );

                if (error) {
                    console.error("resume_guest_checkout failed", {
                        databaseCode: error.code,
                    });

                    throw convertDatabaseError(error.message);
                }

                const order = Array.isArray(data)
                    ? data[0]
                    : data;

                if (!order) {
                    throw new CheckoutError(
                        500,
                        "EMPTY_CHECKOUT_RESULT",
                        "예약 상태를 확인하지 못했습니다.",
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

                console.error(
                    "Unexpected checkout resume error",
                );

                return jsonResponse(
                    {
                        ok: false,
                        error: {
                            code: "INTERNAL_ERROR",
                            message:
                                "예약 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
                        },
                    },
                    500,
                );
            }
        },
    ),
};