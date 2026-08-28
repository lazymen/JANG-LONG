const checkoutLoading = document.getElementById("checkout-loading");
const checkoutError = document.getElementById("checkout-error");
const checkoutEmpty = document.getElementById("checkout-empty");
const checkoutContent = document.getElementById("checkout-content");
const checkoutForm = document.getElementById("checkout-form");
const checkoutReview = document.getElementById("checkout-review");
const checkoutReviewButton = document.getElementById("checkout-review-button");
const checkoutEditButton = document.getElementById("checkout-edit-button");
const checkoutStatusMessage = document.getElementById(
    "checkout-status-message",
);
const checkoutOrderList = document.getElementById("checkout-order-list");
const checkoutSubtotal = document.getElementById("checkout-subtotal");
const checkoutEstimatedTotal = document.getElementById(
    "checkout-estimated-total",
);
const checkoutPaymentButton = document.getElementById(
    "checkout-payment-button",
);

const CHECKOUT_FUNCTION_ENDPOINT =
    `${JANG_LONG_SUPABASE_URL}/functions/v1/start-guest-checkout`;

const CHECKOUT_RESERVATION_STORAGE_KEY = "janglong-active-checkout-reservation";

const CHECKOUT_UNAVAILABLE_MESSAGE =
    "현재 선택하신 상품 중 구매할 수 없는 상품이 있습니다. 장바구니를 다시 확인해주세요.";

const CHECKOUT_RECHECK_ERROR_MESSAGE =
    "상품 상태를 다시 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";

let checkoutCanReview = false;
let activeReservation = loadActiveReservation();
let reservationTimerId = null;

class CheckoutRequestError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function formatPrice(price) {
    return `₩ ${price.toLocaleString()}`;
}

function escapeCheckoutHtml(value) {
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

function createOpaqueToken() {
    const bytes = new Uint8Array(32);

    crypto.getRandomValues(bytes);

    return Array
        .from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function loadActiveReservation() {
    try {
        const savedReservation = localStorage.getItem(
            CHECKOUT_RESERVATION_STORAGE_KEY,
        );

        if (!savedReservation) {
            return null;
        }

        const reservation = JSON.parse(savedReservation);

        if (
            !reservation ||
            !Array.isArray(reservation.productIds) ||
            !reservation.checkoutToken ||
            !reservation.recoveryToken ||
            !reservation.customer
        ) {
            return null;
        }

        return reservation;
    } catch {
        return null;
    }
}

function saveActiveReservation() {
    if (!activeReservation) {
        localStorage.removeItem(CHECKOUT_RESERVATION_STORAGE_KEY);

        return;
    }

    localStorage.setItem(
        CHECKOUT_RESERVATION_STORAGE_KEY,
        JSON.stringify(activeReservation),
    );
}

function clearActiveReservation() {
    activeReservation = null;

    saveActiveReservation();
}

function getRemainingReservationMilliseconds() {
    if (!activeReservation?.expiresAt) {
        return 0;
    }

    return new Date(activeReservation.expiresAt).getTime() - Date.now();
}

function formatRemainingTime(milliseconds) {
    const totalSeconds = Math.max(
        0,
        Math.ceil(milliseconds / 1000),
    );

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getProductStatusLabel(product) {
    if (isGone(product)) {
        return "GONE";
    }

    if (product.status === "reserved") {
        return "RESERVED";
    }

    return "";
}

function isReservedByThisTab(product) {
    return Boolean(
        activeReservation &&
            getRemainingReservationMilliseconds() > 0 &&
            activeReservation.productIds.includes(product.id),
    );
}

function isCheckoutEligible(product) {
    return isAvailable(product) || isReservedByThisTab(product);
}

function getCheckoutDetails() {
    const formData = new FormData(checkoutForm);

    return {
        customerName: String(formData.get("customerName") || "").trim(),
        customerPhone: String(formData.get("customerPhone") || "").trim(),
        customerEmail: String(formData.get("customerEmail") || "").trim(),
        postalCode: String(formData.get("postalCode") || "").trim(),
        addressLine1: String(formData.get("addressLine1") || "").trim(),
        addressLine2: String(formData.get("addressLine2") || "").trim(),
        deliveryNote: String(formData.get("deliveryNote") || "").trim(),
    };
}

function showCheckoutMessage(message) {
    checkoutStatusMessage.textContent = message;
    checkoutStatusMessage.hidden = false;
}

function showOrderReview(details, shouldScroll = true) {
    document.getElementById("review-name").textContent = details.customerName;

    document.getElementById("review-phone").textContent = details.customerPhone;

    document.getElementById("review-email").textContent = details.customerEmail;

    document.getElementById("review-address").textContent = [
        details.postalCode,
        details.addressLine1,
        details.addressLine2,
    ]
        .filter(Boolean)
        .join(" / ");

    document.getElementById("review-delivery-note").textContent =
        details.deliveryNote || "-";

    checkoutForm.hidden = true;
    checkoutReview.hidden = false;
    checkoutEditButton.hidden = Boolean(activeReservation);

    renderReservationButton();

    if (shouldScroll) {
        checkoutReview.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }
}

function renderReservationButton() {
    if (!checkoutPaymentButton) {
        return;
    }

    clearInterval(reservationTimerId);

    const remainingMilliseconds = getRemainingReservationMilliseconds();

    if (activeReservation && remainingMilliseconds > 0) {
        checkoutPaymentButton.disabled = true;
        checkoutPaymentButton.dataset.reservationActive = "true";
        checkoutPaymentButton.textContent = `RESERVED ${
            formatRemainingTime(remainingMilliseconds)
        }`;

        reservationTimerId = setInterval(() => {
            const remaining = getRemainingReservationMilliseconds();

            if (remaining <= 0) {
                clearInterval(reservationTimerId);
                clearActiveReservation();

                checkoutPaymentButton.disabled = true;
                checkoutPaymentButton.textContent = "RESERVATION EXPIRED";

                loadProductsByIds(getCart())
                    .then(renderCheckout)
                    .catch(console.error);

                return;
            }

            checkoutPaymentButton.textContent = `RESERVED ${
                formatRemainingTime(remaining)
            }`;
        }, 1000);

        return;
    }

    if (activeReservation && !activeReservation.expiresAt) {
        checkoutPaymentButton.disabled = false;
        checkoutPaymentButton.dataset.reservationActive = "false";
        checkoutPaymentButton.textContent = "CHECK RESERVATION STATUS";

        return;
    }

    checkoutPaymentButton.dataset.reservationActive = "false";
    checkoutPaymentButton.disabled = !checkoutCanReview;
    checkoutPaymentButton.textContent = "START 5-MINUTE RESERVATION";
}

function renderCheckout(products) {
    const storedCartIds = getCart();

    const loadedProductIds = new Set(
        products.map((product) => product.id),
    );

    const hasMissingProducts = storedCartIds.some(
        (productId) => !loadedProductIds.has(productId),
    );

    const cartIds = removeMissingProductsFromCart(products);

    updateCartCount();

    const cartProducts = cartIds
        .map((productId) => findProductById(products, productId))
        .filter(Boolean);

    checkoutLoading.hidden = true;
    checkoutEmpty.hidden = true;
    checkoutContent.hidden = true;
    checkoutCanReview = false;

    if (cartProducts.length === 0) {
        checkoutEmpty.hidden = false;

        return;
    }

    const eligibleProducts = cartProducts.filter(
        isCheckoutEligible,
    );

    const hasUnavailableProducts = hasMissingProducts ||
        eligibleProducts.length !== cartProducts.length;

    checkoutOrderList.innerHTML = cartProducts
        .map((product) => {
            const statusLabel = getProductStatusLabel(product);
            const safeProductName = escapeCheckoutHtml(product.name);
            const safeProductSize = escapeCheckoutHtml(product.size || "-");

            return `
                <article class="checkout-order-item ${
                statusLabel ? "unavailable" : ""
            }">
                    <img
                        src="images/products/${product.id}/main.jpg"
                        alt="${safeProductName}"
                    >

                    <div>
                        <a href="product.html?id=${product.id}">
                            ${safeProductName}
                        </a>

                        <p>${safeProductSize}</p>

                        ${
                statusLabel
                    ? `<p class="checkout-order-status">${statusLabel}</p>`
                    : ""
            }
                    </div>

                    <p>${formatPrice(product.price)}</p>
                </article>
            `;
        })
        .join("");

    const subtotal = eligibleProducts.reduce(
        (sum, product) => sum + product.price,
        0,
    );

    checkoutSubtotal.textContent = formatPrice(subtotal);
    checkoutEstimatedTotal.textContent = `${formatPrice(subtotal)} + SHIPPING`;

    checkoutReviewButton.disabled = eligibleProducts.length === 0 ||
        hasUnavailableProducts;

    checkoutCanReview = !checkoutReviewButton.disabled;

    if (!activeReservation) {
        checkoutStatusMessage.textContent = CHECKOUT_UNAVAILABLE_MESSAGE;

        checkoutStatusMessage.hidden = !hasUnavailableProducts;
    }

    checkoutContent.hidden = false;

    renderReservationButton();
}

async function callCheckoutFunction(reservation) {
    const response = await fetch(CHECKOUT_FUNCTION_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: JANG_LONG_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${JANG_LONG_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
            checkoutToken: reservation.checkoutToken,
            recoveryToken: reservation.recoveryToken,
            customerName: reservation.customer.customerName,
            customerPhone: reservation.customer.customerPhone,
            customerEmail: reservation.customer.customerEmail,
            postalCode: reservation.customer.postalCode,
            addressLine1: reservation.customer.addressLine1,
            addressLine2: reservation.customer.addressLine2,
            deliveryNote: reservation.customer.deliveryNote,
            productIds: reservation.productIds,
            isRemoteArea: false,
        }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new CheckoutRequestError(
            payload?.code || payload?.error?.code || "CHECKOUT_START_FAILED",
            payload?.message ||
                "상품 예약을 시작하지 못했습니다.",
        );
    }

    const reservationResult = payload?.data ||
        payload?.order ||
        payload;

    if (!reservationResult?.reservation_expires_at) {
        throw new CheckoutRequestError(
            "INVALID_CHECKOUT_RESPONSE",
            "상품 예약 정보를 확인하지 못했습니다.",
        );
    }

    return reservationResult;
}

function createReservation(details) {
    return {
        checkoutToken: createOpaqueToken(),
        recoveryToken: createOpaqueToken(),
        customer: details,
        productIds: [...new Set(getCart())].filter(
            (productId) => /^[0-9]{4}$/.test(productId),
        ),
        expiresAt: null,
        orderId: null,
        orderNumber: null,
    };
}

function handleReservationError(error) {
    console.error(error);

    if (error.code === "CHECKOUT_RESERVATION_EXPIRED") {
        clearActiveReservation();

        showCheckoutMessage(
            "예약 시간이 만료되었습니다. 상품 상태를 다시 확인해주세요.",
        );

        return;
    }

    if (error.code === "CHECKOUT_PRODUCTS_UNAVAILABLE") {
        clearActiveReservation();

        showCheckoutMessage(
            "방금 상품 상태가 바뀌었습니다. 장바구니를 다시 확인해주세요.",
        );

        return;
    }

    showCheckoutMessage(
        "상품 예약을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
}

async function resumeActiveReservation() {
    if (!activeReservation) {
        return;
    }

    if (
        activeReservation.expiresAt &&
        getRemainingReservationMilliseconds() <= 0
    ) {
        clearActiveReservation();

        return;
    }

    const reservationResult = await callCheckoutFunction(
        activeReservation,
    );

    activeReservation.expiresAt = reservationResult.reservation_expires_at;

    activeReservation.orderId = reservationResult.order_id || null;

    activeReservation.orderNumber = reservationResult.order_number || null;

    saveActiveReservation();
}

checkoutForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        if (!checkoutForm.reportValidity()) {
            return;
        }

        const originalButtonText = checkoutReviewButton.textContent;

        checkoutCanReview = false;
        checkoutReviewButton.disabled = true;
        checkoutReviewButton.textContent = "CHECKING...";
        checkoutStatusMessage.hidden = true;

        try {
            const latestProducts = await loadProductsByIds(getCart());

            renderCheckout(latestProducts);

            if (!checkoutCanReview) {
                return;
            }

            showOrderReview(getCheckoutDetails());
        } catch (error) {
            console.error(error);

            showCheckoutMessage(CHECKOUT_RECHECK_ERROR_MESSAGE);
        } finally {
            checkoutReviewButton.textContent = originalButtonText;
            checkoutReviewButton.disabled = !checkoutCanReview;
        }
    },
);

checkoutEditButton.addEventListener(
    "click",
    () => {
        if (activeReservation) {
            return;
        }

        checkoutReview.hidden = true;
        checkoutForm.hidden = false;

        checkoutForm.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    },
);

checkoutPaymentButton.addEventListener(
    "click",
    async () => {
        if (
            activeReservation &&
            getRemainingReservationMilliseconds() > 0
        ) {
            return;
        }

        if (!activeReservation && !checkoutCanReview) {
            return;
        }

        if (!activeReservation) {
            activeReservation = createReservation(
                getCheckoutDetails(),
            );

            saveActiveReservation();
        }

        checkoutPaymentButton.disabled = true;
        checkoutPaymentButton.textContent = "RESERVING...";
        checkoutStatusMessage.hidden = true;

        try {
            await resumeActiveReservation();

            const latestProducts = await loadProductsByIds(getCart());

            renderCheckout(latestProducts);

            showOrderReview(
                activeReservation.customer,
                false,
            );
        } catch (error) {
            handleReservationError(error);

            const latestProducts = await loadProductsByIds(getCart());

            renderCheckout(latestProducts);
        }
    },
);

async function initialiseCheckout() {
    try {
        await resumeActiveReservation();
    } catch (error) {
        handleReservationError(error);
    }

    try {
        const products = await loadProductsByIds(getCart());

        renderCheckout(products);

        if (activeReservation) {
            showOrderReview(
                activeReservation.customer,
                false,
            );
        }
    } catch (error) {
        console.error(error);

        checkoutLoading.hidden = true;
        checkoutError.hidden = false;
    }
}

initialiseCheckout();