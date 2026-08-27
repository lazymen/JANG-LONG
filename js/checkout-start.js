(() => {
    const CHECKOUT_FUNCTION_URL =
        `${JANG_LONG_SUPABASE_URL}/functions/v1/start-guest-checkout`;

    const CHECKOUT_SESSION_KEY = "janglong-guest-checkout-session";

    const checkoutForm = document.getElementById("checkout-form");

    const paymentButton = document.getElementById("checkout-payment-button");

    const editButton = document.getElementById("checkout-edit-button");

    const paymentMessage = document.getElementById("checkout-payment-message");

    const shippingElement = document.getElementById("checkout-shipping");

    const totalElement = document.getElementById("checkout-estimated-total");

    if (
        !checkoutForm ||
        !paymentButton ||
        !editButton ||
        !paymentMessage
    ) {
        return;
    }

    const ORIGINAL_BUTTON_TEXT = "START 10-MINUTE RESERVATION";

    let countdownTimer = null;

    function createSecureToken() {
        const bytes = new Uint8Array(32);

        crypto.getRandomValues(bytes);

        return Array
            .from(bytes)
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    function getCartSignature(productIds) {
        return JSON.stringify(
            [...productIds].sort(),
        );
    }

    function readCheckoutSession() {
        try {
            return JSON.parse(
                sessionStorage.getItem(
                    CHECKOUT_SESSION_KEY,
                ),
            );
        } catch {
            return null;
        }
    }

    function saveCheckoutSession(session) {
        sessionStorage.setItem(
            CHECKOUT_SESSION_KEY,
            JSON.stringify(session),
        );
    }

    function getOrCreateCheckoutSession(productIds) {
        const cartSignature = getCartSignature(productIds);

        const existingSession = readCheckoutSession();

        if (
            existingSession &&
            existingSession.cartSignature === cartSignature
        ) {
            return existingSession;
        }

        const newSession = {
            cartSignature,
            checkoutToken: createSecureToken(),
            recoveryToken: createSecureToken(),
        };

        saveCheckoutSession(newSession);

        return newSession;
    }

    function formatCheckoutPrice(value) {
        return `₩ ${Number(value).toLocaleString()}`;
    }

    function showPaymentMessage(text) {
        paymentMessage.textContent = text;
        paymentMessage.hidden = false;
    }

    function extractOrder(payload) {
        const result = payload?.order ??
            payload?.data ??
            payload?.result ??
            payload;

        return Array.isArray(result) ? result[0] : result;
    }

    function getOrderValue(order, snakeCase, camelCase) {
        return order?.[snakeCase] ??
            order?.[camelCase];
    }

    function getErrorCode(payload) {
        return (
            payload?.error?.code ??
                payload?.code ??
                payload?.error ??
                "CHECKOUT_REQUEST_FAILED"
        );
    }

    function getCustomerMessage(errorCode) {
        const messages = {
            CHECKOUT_PRODUCTS_UNAVAILABLE:
                "현재 선택하신 상품 중 구매할 수 없는 상품이 있습니다. 장바구니를 다시 확인해주세요.",

            CHECKOUT_RESERVATION_EXPIRED:
                "이전 상품 예약이 종료되었습니다. 장바구니에서 다시 확인해주세요.",

            CHECKOUT_SESSION_CLOSED:
                "이 결제 진행은 종료되었습니다. 장바구니에서 다시 시작해주세요.",

            CHECKOUT_KEY_REUSED_WITH_DIFFERENT_DATA:
                "진행 중인 주문 정보와 현재 입력 정보가 다릅니다. 페이지를 새로고침한 뒤 다시 확인해주세요.",

            INVALID_REMOTE_AREA_STATE:
                "배송 지역을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
        };

        return messages[errorCode] ??
            "상품 예약을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.";
    }

    function startCountdown(expiresAt) {
        const expirationTime = Date.parse(expiresAt);

        if (Number.isNaN(expirationTime)) {
            paymentButton.textContent = "RESERVATION STARTED";

            return;
        }

        paymentButton.dataset.reservationActive = "true";

        paymentButton.disabled = true;
        editButton.disabled = true;

        clearInterval(countdownTimer);

        function updateCountdown() {
            const remainingMilliseconds = expirationTime - Date.now();

            if (remainingMilliseconds <= 0) {
                clearInterval(countdownTimer);

                paymentButton.textContent = "RESERVATION EXPIRED";

                showPaymentMessage(
                    "10분의 상품 예약 시간이 종료되었습니다. 상품 상태를 다시 확인해주세요.",
                );

                return;
            }

            const remainingSeconds = Math.ceil(
                remainingMilliseconds / 1000,
            );

            const minutes = Math.floor(remainingSeconds / 60);

            const seconds = remainingSeconds % 60;

            paymentButton.textContent = `RESERVED ${minutes}:${
                String(seconds).padStart(2, "0")
            }`;
        }

        updateCountdown();

        countdownTimer = setInterval(updateCountdown, 1000);
    }

    paymentButton.addEventListener(
        "click",
        async () => {
            if (!checkoutForm.reportValidity()) {
                return;
            }

            const productIds = getCart();

            if (productIds.length === 0) {
                showPaymentMessage(
                    "장바구니가 비어 있습니다.",
                );

                return;
            }

            const formData = new FormData(checkoutForm);

            const checkoutSession = getOrCreateCheckoutSession(
                productIds,
            );

            paymentButton.disabled = true;
            editButton.disabled = true;

            paymentButton.textContent = "RESERVING...";

            paymentMessage.hidden = true;

            try {
                const response = await fetch(
                    CHECKOUT_FUNCTION_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json",
                            apikey: JANG_LONG_SUPABASE_PUBLISHABLE_KEY,
                        },

                        cache: "no-store",

                        body: JSON.stringify({
                            checkoutToken: checkoutSession.checkoutToken,

                            recoveryToken: checkoutSession.recoveryToken,

                            customerName: String(
                                formData.get("customerName") ?? "",
                            ).trim(),

                            customerPhone: String(
                                formData.get("customerPhone") ?? "",
                            ).trim(),

                            customerEmail: String(
                                formData.get("customerEmail") ?? "",
                            ).trim(),

                            postalCode: String(
                                formData.get("postalCode") ?? "",
                            ).trim(),

                            addressLine1: String(
                                formData.get("addressLine1") ?? "",
                            ).trim(),

                            addressLine2: String(
                                formData.get("addressLine2") ?? "",
                            ).trim(),

                            deliveryNote: String(
                                formData.get("deliveryNote") ?? "",
                            ).trim(),

                            productIds,
                        }),
                    },
                );

                const payload = await response
                    .json()
                    .catch(() => ({}));

                if (!response.ok) {
                    const errorCode = getErrorCode(payload);

                    throw Object.assign(
                        new Error(errorCode),
                        { code: errorCode },
                    );
                }

                const order = extractOrder(payload);

                const orderId = getOrderValue(
                    order,
                    "order_id",
                    "orderId",
                );

                const orderNumber = getOrderValue(
                    order,
                    "order_number",
                    "orderNumber",
                );

                const expiresAt = getOrderValue(
                    order,
                    "reservation_expires_at",
                    "reservationExpiresAt",
                );

                if (!orderId || !expiresAt) {
                    throw Object.assign(
                        new Error(
                            "INVALID_CHECKOUT_RESPONSE",
                        ),
                        {
                            code: "INVALID_CHECKOUT_RESPONSE",
                        },
                    );
                }

                checkoutSession.orderId = orderId;

                checkoutSession.orderNumber = orderNumber;

                checkoutSession.expiresAt = expiresAt;

                saveCheckoutSession(
                    checkoutSession,
                );

                const shippingFee = Number(
                    getOrderValue(
                        order,
                        "shipping_fee",
                        "shippingFee",
                    ),
                );

                const totalAmount = Number(
                    getOrderValue(
                        order,
                        "total_amount",
                        "totalAmount",
                    ),
                );

                if (
                    shippingElement &&
                    Number.isFinite(shippingFee)
                ) {
                    shippingElement.textContent = formatCheckoutPrice(
                        shippingFee,
                    );
                }

                if (
                    totalElement &&
                    Number.isFinite(totalAmount)
                ) {
                    totalElement.textContent = formatCheckoutPrice(
                        totalAmount,
                    );
                }

                showPaymentMessage(
                    `상품 예약이 시작되었습니다. 주문번호: ${
                        orderNumber ?? orderId
                    }`,
                );

                startCountdown(expiresAt);
            } catch (error) {
                console.error(error);

                paymentButton.disabled = false;
                editButton.disabled = false;

                paymentButton.textContent = ORIGINAL_BUTTON_TEXT;

                showPaymentMessage(
                    `${getCustomerMessage(error.code)} [${
                        error.code ?? error.message ?? "UNKNOWN"
                    }]`,
                );
            }
        },
    );

    const savedSession = readCheckoutSession();

    if (
        savedSession?.expiresAt &&
        Date.parse(savedSession.expiresAt) > Date.now()
    ) {
        showPaymentMessage(
            `진행 중인 상품 예약이 있습니다. 주문번호: ${
                savedSession.orderNumber ?? savedSession.orderId
            }`,
        );

        startCountdown(
            savedSession.expiresAt,
        );
    }
})();
