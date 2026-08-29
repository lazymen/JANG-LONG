(() => {
    const START_URL =
        `${JANG_LONG_SUPABASE_URL}/functions/v1/start-guest-checkout`;

    const RESUME_URL =
        `${JANG_LONG_SUPABASE_URL}/functions/v1/resume-guest-checkout`;
    const CANCEL_URL =
        `${JANG_LONG_SUPABASE_URL}/functions/v1/cancel-guest-checkout`;

    const SESSION_KEY = "janglong-guest-checkout-reservation-v1";

    const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
    const PRODUCT_ID_PATTERN = /^[0-9]{4}$/;
    const START_LABEL = "START 5-MINUTE RESERVATION";

    const form = document.getElementById("checkout-form");
    const paymentButton = document.getElementById("checkout-payment-button");
    const editButton = document.getElementById("checkout-edit-button");
    const paymentMessage = document.getElementById(
        "checkout-payment-message",
    );
    const statusMessage = document.getElementById(
        "checkout-status-message",
    );
    const shipping = document.getElementById("checkout-shipping");
    const total = document.getElementById("checkout-estimated-total");
    const checkoutSubtotalElement = document.getElementById(
        "checkout-subtotal",
    );
    const orderList = document.getElementById("checkout-order-list");
    const review = document.getElementById("checkout-review");
    const content = document.getElementById("checkout-content");
    const empty = document.getElementById("checkout-empty");
    const loading = document.getElementById("checkout-loading");
    const active = document.getElementById("checkout-active-reservation");
    const activeOrderNumber = document.getElementById(
        "active-reservation-order-number",
    );
    const activeCountdown = document.getElementById(
        "active-reservation-countdown",
    );
    const activeCancelButton = document.getElementById(
        "active-reservation-cancel-button"
    );
    const activeMessage = document.getElementById(
        "active-reservation-message"
    );

    if (
        !form ||
        !paymentButton ||
        !editButton ||
        !paymentMessage ||
        !review ||
        !active ||
        !activeOrderNumber ||
        !activeCountdown
    ) {
        return;
    }

    let countdownTimer = null;

    function setRecoveryInProgress(value) {
        window.jangLongReservationRecoveryInProgress = value;
    }

    function createToken() {
        const bytes = new Uint8Array(32);

        crypto.getRandomValues(bytes);

        return Array.from(
            bytes,
            (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
    }

    function cartSignature(productIds) {
        return JSON.stringify([...productIds].sort());
    }

    function isStoredSession(value) {
        return Boolean(
            value &&
            typeof value === "object" &&
            typeof value.cartSignature === "string" &&
            typeof value.checkoutToken === "string" &&
            TOKEN_PATTERN.test(value.checkoutToken) &&
            typeof value.recoveryToken === "string" &&
            TOKEN_PATTERN.test(value.recoveryToken),
        );
    }

    function readSession() {
        try {
            const value = JSON.parse(
                localStorage.getItem(SESSION_KEY),
            );

            return isStoredSession(value) ? value : null;
        } catch {
            return null;
        }
    }

    function saveSession(session) {
        localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
                version: 1,
                cartSignature: session.cartSignature,
                checkoutToken: session.checkoutToken,
                recoveryToken: session.recoveryToken,
                orderId: session.orderId ?? null,
                orderNumber: session.orderNumber ?? null,
                expiresAt: session.expiresAt ?? null,
            }),
        );
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    function showPaymentMessage(message) {
        paymentMessage.textContent = message;
        paymentMessage.hidden = false;
    }

    function showStatusMessage(message) {
        if (!statusMessage) {
            return;
        }

        statusMessage.textContent = message;
        statusMessage.hidden = false;
    }

    function getErrorCode(payload) {
        return payload?.error?.code ??
            payload?.code ??
            "CHECKOUT_REQUEST_FAILED";
    }

    function customerMessage(code) {
        const messages = {
            CHECKOUT_PRODUCTS_UNAVAILABLE:
                "현재 선택하신 상품 중 구매할 수 없는 상품이 있습니다. 장바구니를 다시 확인해주세요.",

            CHECKOUT_RESERVATION_EXPIRED:
                "이전 상품 예약이 종료되었습니다. 상품 상태를 다시 확인해주세요.",

            CHECKOUT_SESSION_CLOSED:
                "이 결제 진행은 종료되었습니다. 장바구니에서 다시 시작해주세요.",

            CHECKOUT_RECOVERY_NOT_FOUND:
                "진행 중인 예약을 찾지 못했습니다. 장바구니에서 다시 시도해주세요.",

            CHECKOUT_ACTIVE_RESERVATION_EXISTS:
                "같은 브라우저에 진행 중인 예약이 있습니다. 예약이 끝난 뒤 다시 시도해주세요.",

            CHECKOUT_RESERVATION_CONFIRMATION_REQUIRED:
                "기존 예약 상태를 먼저 확인해야 합니다. 페이지를 새로고침해 다시 확인해주세요.",
        };

        return messages[code] ??
            "상품 예약을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.";
    }

    function orderFrom(payload) {
        const value = payload?.order ??
            payload?.data ??
            payload?.result ??
            payload;

        return Array.isArray(value) ? value[0] : value;
    }

    function orderValue(order, snakeCase, camelCase) {
        return order?.[snakeCase] ?? order?.[camelCase];
    }

    async function callFunction(
        url,
        body,
        { expectsOrder = true } = {},
    ) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: JANG_LONG_SUPABASE_PUBLISHABLE_KEY,
            },
            cache: "no-store",
            body: JSON.stringify(body),
        });

        const payload = await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
            throw Object.assign(
                new Error(getErrorCode(payload)),
                { code: getErrorCode(payload) },
            );
        }

        if (!expectsOrder) {
            return payload;
        }

        const order = orderFrom(payload);

        const orderId = orderValue(order, "order_id", "orderId");

        const expiresAt = orderValue(
            order,
            "reservation_expires_at",
            "reservationExpiresAt",
        );

        if (!orderId || !expiresAt) {
            throw Object.assign(
                new Error("INVALID_CHECKOUT_RESPONSE"),
                { code: "INVALID_CHECKOUT_RESPONSE" },
            );
        }

        return order;
    }

    function formatPrice(value) {
        return `₩ ${Number(value).toLocaleString()}`;
    }

    function escapeHtml(value) {
        return String(value).replace(
            /[&<>"']/g,
            (character) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;",
                })[character],
        );
    }

    function updatePrice(order) {
        const subtotalAmount = Number(
            orderValue(order, "subtotal", "subtotal"),
        );

        const shippingFee = Number(
            orderValue(order, "shipping_fee", "shippingFee"),
        );

        const totalAmount = Number(
            orderValue(order, "total_amount", "totalAmount"),
        );

        if (
            checkoutSubtotalElement &&
            Number.isFinite(subtotalAmount)
        ) {
            checkoutSubtotalElement.textContent =
                formatPrice(subtotalAmount);
        }

        if (shipping && Number.isFinite(shippingFee)) {
            shipping.textContent = formatPrice(shippingFee);
        }

        if (total && Number.isFinite(totalAmount)) {
            total.textContent = formatPrice(totalAmount);
        }
    }

    function renderOrderItems(order) {
        const items = orderValue(order, "order_items", "orderItems");

        if (!orderList || !Array.isArray(items)) {
            return;
        }

        orderList.innerHTML = items
            .map((item) => {
                const productId = String(
                    orderValue(item, "product_id", "productId") ?? "",
                );

                const name = String(
                    orderValue(item, "product_name", "productName") ?? "",
                );

                const size = String(item?.size ?? "-");

                const price = Number(
                    orderValue(item, "unit_price", "unitPrice"),
                );

                const imagePath = String(
                    orderValue(item, "image_path", "imagePath") ?? "",
                );

                const safeImagePath =
                    /^images\/products\/[0-9]{4}\/[A-Za-z0-9._-]+$/.test(
                        imagePath,
                    )
                        ? imagePath
                        : `images/products/${productId}/main.jpg`;

                return `
                    <article class="checkout-order-item">
                        <img
                            src="${escapeHtml(safeImagePath)}"
                            alt="${escapeHtml(name)}"
                        >

                        <div>
                            <p>${escapeHtml(name)}</p>
                            <p>${escapeHtml(size)}</p>
                        </div>

                        <p>${formatPrice(price)}</p>
                    </article>
                `;
            })
            .join("");
    }

    function showRecoveredReservation(order) {
        if (loading) {
            loading.hidden = true;
        }

        if (empty) {
            empty.hidden = true;
        }

        if (content) {
            content.hidden = false;
        }

        form.hidden = true;
        review.hidden = true;
        active.hidden = false;

        if (activeCancelButton) {
            activeCancelButton.disabled = false;
            activeCancelButton.textContent = "CANCEL RESERVATION";
        }

        if (activeMessage) {
            activeMessage.hidden = true;
            activeMessage.textContent = "";
        }

        activeOrderNumber.textContent =
            orderValue(order, "order_number", "orderNumber") ??
            orderValue(order, "order_id", "orderId");

        renderOrderItems(order);
        updatePrice(order);
    }

    function endReservation(message) {
        clearInterval(countdownTimer);
        clearSession();
        setRecoveryInProgress(false);

        active.hidden = true;
        review.hidden = true;
        form.hidden = false;

        paymentButton.dataset.reservationActive = "false";
        paymentButton.disabled = false;
        paymentButton.textContent = START_LABEL;
        editButton.disabled = false;

        showStatusMessage(message);

        if (paymentMessage) {
            paymentMessage.hidden = true;
            paymentMessage.textContent = "";
        }

        if (
            typeof loadProductsByIds === "function" &&
            typeof renderCheckout === "function"
        ) {
            loadProductsByIds(getCart())
                .then(renderCheckout)
                .catch(console.error);
        }
    }


    function showActiveMessage(message) {

        if (!activeMessage) {
            return;
        }

        activeMessage.textContent = message;
        activeMessage.hidden = false;

    }

    async function cancelReservation() {

        const session = readSession();

        if (!session) {
            endReservation(
                "예약 정보를 찾을 수 없습니다. 장바구니에서 다시 시작해주세요."
            );

            return;
        }

        const confirmed = window.confirm(
            "예약을 취소할까요?\n상품은 다시 구매 가능 상태가 됩니다."
        );

        if (!confirmed) {
            return;
        }

        const originalLabel =
            activeCancelButton.textContent;

        activeCancelButton.disabled = true;

        activeCancelButton.textContent =
            "CANCELLING...";

        if (activeMessage) {
            activeMessage.hidden = true;
        }

        try {

            await callFunction(
                CANCEL_URL,
                {
                    checkoutToken: session.checkoutToken,
                    recoveryToken: session.recoveryToken,
                },
                {
                    expectsOrder: false,
                },
            );
            endReservation(
                "상품 예약을 취소했습니다. 상품을 다시 구매할 수 있습니다.",
            );
        } catch (error) {

            console.error(error);

            const code = error?.code;

            if (
                [
                    "CHECKOUT_RECOVERY_NOT_FOUND",
                    "CHECKOUT_RESERVATION_EXPIRED",
                    "CHECKOUT_SESSION_CLOSED",
                ].includes(code)
            ) {
                endReservation(customerMessage(code));

                return;
            }

            activeCancelButton.disabled = false;

            activeCancelButton.textContent =
                originalLabel;

            if (code === "CHECKOUT_PAYMENT_STATUS_UNRESOLVED") {
                showActiveMessage(
                    "결제 상태를 확인하는 중에는 예약을 취소할 수 없습니다."
                );

                return;
            }

            showActiveMessage(
                "예약 취소에 실패했습니다. 잠시 후 다시 시도해주세요."
            );

        }

    }

    function startCountdown(expiresAt) {
        const end = Date.parse(expiresAt);

        if (Number.isNaN(end)) {
            return;
        }

        clearInterval(countdownTimer);

        paymentButton.dataset.reservationActive = "true";
        paymentButton.disabled = true;
        editButton.disabled = true;

        function update() {
            const remaining = end - Date.now();

            if (remaining <= 0) {
                endReservation(
                    "상품 예약 시간이 종료되었습니다. 장바구니 상품 상태를 다시 확인해주세요.",
                );

                return;
            }

            const seconds = Math.ceil(remaining / 1000);

            const label = `RESERVED ${Math.floor(seconds / 60)
                }:${String(seconds % 60).padStart(2, "0")}`;

            paymentButton.textContent = label;
            activeCountdown.textContent = label;
        }

        update();

        countdownTimer = setInterval(update, 1000);
    }

    async function resumeReservation(session) {
        try {
            const order = await callFunction(RESUME_URL, {
                checkoutToken: session.checkoutToken,
                recoveryToken: session.recoveryToken,
            });

            const nextSession = {
                ...session,
                orderId: orderValue(order, "order_id", "orderId"),
                orderNumber: orderValue(
                    order,
                    "order_number",
                    "orderNumber",
                ),
                expiresAt: orderValue(
                    order,
                    "reservation_expires_at",
                    "reservationExpiresAt",
                ),
            };

            saveSession(nextSession);
            showRecoveredReservation(order);
            startCountdown(nextSession.expiresAt);
        } catch (error) {
            console.error(error);

            if (
                [
                    "CHECKOUT_RECOVERY_NOT_FOUND",
                    "CHECKOUT_RESERVATION_EXPIRED",
                    "CHECKOUT_SESSION_CLOSED",
                ].includes(error.code)
            ) {
                endReservation(customerMessage(error.code));

                return;
            }

            setRecoveryInProgress(false);

            showStatusMessage(
                "예약 상태를 확인하지 못했습니다. 잠시 후 다시 확인해주세요.",
            );
        }
    }

    paymentButton.addEventListener(
        "click",
        async () => {
            if (!form.reportValidity()) {
                return;
            }

            const productIds = [...new Set(getCart())].filter(
                (productId) => PRODUCT_ID_PATTERN.test(productId),
            );

            if (productIds.length === 0) {
                showPaymentMessage("장바구니가 비어 있습니다.");

                return;
            }

            const signature = cartSignature(productIds);

            let session = readSession();

            if (session && session.cartSignature !== signature) {
                showPaymentMessage(
                    customerMessage(
                        "CHECKOUT_RESERVATION_CONFIRMATION_REQUIRED",
                    ),
                );

                return;
            }

            if (!session) {
                session = {
                    cartSignature: signature,
                    checkoutToken: createToken(),
                    recoveryToken: createToken(),
                };

                saveSession(session);
            }

            const values = new FormData(form);

            paymentButton.disabled = true;
            editButton.disabled = true;
            paymentButton.textContent = "RESERVING...";
            paymentMessage.hidden = true;

            try {
                const order = await callFunction(START_URL, {
                    checkoutToken: session.checkoutToken,
                    recoveryToken: session.recoveryToken,
                    customerName: String(
                        values.get("customerName") ?? "",
                    ).trim(),
                    customerPhone: String(
                        values.get("customerPhone") ?? "",
                    ).trim(),
                    customerEmail: String(
                        values.get("customerEmail") ?? "",
                    ).trim(),
                    postalCode: String(
                        values.get("postalCode") ?? "",
                    ).trim(),
                    addressLine1: String(
                        values.get("addressLine1") ?? "",
                    ).trim(),
                    addressLine2: String(
                        values.get("addressLine2") ?? "",
                    ).trim(),
                    deliveryNote: String(
                        values.get("deliveryNote") ?? "",
                    ).trim(),
                    productIds,
                });

                const expiresAt = orderValue(
                    order,
                    "reservation_expires_at",
                    "reservationExpiresAt",
                );

                saveSession({
                    ...session,
                    orderId: orderValue(order, "order_id", "orderId"),
                    orderNumber: orderValue(
                        order,
                        "order_number",
                        "orderNumber",
                    ),
                    expiresAt,
                });

                updatePrice(order);

                showPaymentMessage(
                    `상품 예약이 시작되었습니다. 주문번호: ${orderValue(
                        order,
                        "order_number",
                        "orderNumber",
                    ) ??
                    orderValue(order, "order_id", "orderId")
                    }`,
                );

                showRecoveredReservation(order);
                startCountdown(expiresAt);
            } catch (error) {
                console.error(error);

                const noReservationErrorCodes = [
                    "CHECKOUT_PRODUCTS_UNAVAILABLE",
                    "EMPTY_CART",
                    "INVALID_PRODUCT_ID",
                    "DUPLICATE_PRODUCT_ID",
                    "INVALID_REQUEST",
                    "INVALID_CHECKOUT_TOKEN",
                    "FORBIDDEN_CHECKOUT_FIELD",
                ];

                if (noReservationErrorCodes.includes(error.code)) {
                    clearSession();

                    paymentButton.disabled = false;
                    editButton.disabled = false;
                    paymentButton.textContent = START_LABEL;

                    showPaymentMessage(customerMessage(error.code));

                    return;
                }

                setRecoveryInProgress(true);

                showPaymentMessage(
                    "예약 상태를 확인하고 있습니다. 잠시만 기다려주세요.",
                );

                await resumeReservation(session);
            }
        },
    );
    if (activeCancelButton) {

        activeCancelButton.addEventListener(
            "click",
            () => {
                void cancelReservation();
            }
        );

    }
    const savedSession = readSession();

    if (savedSession) {
        setRecoveryInProgress(true);
        resumeReservation(savedSession);
    }
})();