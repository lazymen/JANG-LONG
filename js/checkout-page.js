const checkoutLoading =
    document.getElementById("checkout-loading");

const checkoutError =
    document.getElementById("checkout-error");

const checkoutEmpty =
    document.getElementById("checkout-empty");

const checkoutContent =
    document.getElementById("checkout-content");

const checkoutForm =
    document.getElementById("checkout-form");

const checkoutReview =
    document.getElementById("checkout-review");

const checkoutReviewButton =
    document.getElementById("checkout-review-button");

const checkoutEditButton =
    document.getElementById("checkout-edit-button");

const checkoutStatusMessage =
    document.getElementById("checkout-status-message");

const checkoutOrderList =
    document.getElementById("checkout-order-list");

const checkoutSubtotal =
    document.getElementById("checkout-subtotal");

const checkoutEstimatedTotal =
    document.getElementById("checkout-estimated-total");


const CHECKOUT_UNAVAILABLE_MESSAGE =
    "현재 선택하신 상품 중 구매할 수 없는 상품이 있습니다. 장바구니를 다시 확인해주세요.";

const CHECKOUT_RECHECK_ERROR_MESSAGE =
    "상품 상태를 다시 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";

let checkoutCanReview = false;


function formatPrice(price) {

    return `₩ ${price.toLocaleString()}`;

}


function escapeCheckoutHtml(value) {

    return String(value).replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#039;"
        })[character]
    );

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


function renderCheckout(products) {

    const storedCartIds = getCart();

    const loadedProductIds = new Set(
        products.map(product => product.id)
    );

    const hasMissingProducts = storedCartIds.some(
        productId => !loadedProductIds.has(productId)
    );

    const cartIds = removeMissingProductsFromCart(products);

    updateCartCount();


    const cartProducts = cartIds
        .map(productId =>
            findProductById(products, productId)
        )
        .filter(Boolean);


    checkoutLoading.hidden = true;
    checkoutEmpty.hidden = true;
    checkoutContent.hidden = true;
    checkoutCanReview = false;


    if (cartProducts.length === 0) {

        checkoutEmpty.hidden = false;

        return;
    }


    const availableProducts =
        cartProducts.filter(isAvailable);

    const hasUnavailableProducts =
        hasMissingProducts ||
        availableProducts.length !== cartProducts.length;


    checkoutOrderList.innerHTML = cartProducts
        .map(product => {

            const statusLabel =
                getProductStatusLabel(product);

            const safeProductName =
                escapeCheckoutHtml(product.name);

            const safeProductSize =
                escapeCheckoutHtml(product.size || "-");

            return `

                <article class="checkout-order-item ${statusLabel ? "unavailable" : ""}">

                    <img
                        src="images/products/${product.id}/main.jpg"
                        alt="${safeProductName}"
                    >

                    <div>

                        <a href="product.html?id=${product.id}">
                            ${safeProductName}
                        </a>

                        <p>${safeProductSize}</p>

                        ${statusLabel
                    ? `<p class="checkout-order-status">${statusLabel}</p>`
                    : ""
                }

                    </div>

                    <p>${formatPrice(product.price)}</p>

                </article>

            `;

        })
        .join("");


    const subtotal = availableProducts
        .reduce(
            (sum, product) =>
                sum + product.price,
            0
        );


    checkoutSubtotal.textContent =
        formatPrice(subtotal);

    checkoutEstimatedTotal.textContent =
        `${formatPrice(subtotal)} + SHIPPING`;


    checkoutReviewButton.disabled =
        availableProducts.length === 0 ||
        hasUnavailableProducts;

    checkoutCanReview =
        !checkoutReviewButton.disabled;

    checkoutStatusMessage.textContent =
        CHECKOUT_UNAVAILABLE_MESSAGE;

    checkoutStatusMessage.hidden =
        !hasUnavailableProducts;

    checkoutContent.hidden = false;

}


function showOrderReview() {

    const formData = new FormData(checkoutForm);

    const customerName =
        formData.get("customerName").trim();

    const customerPhone =
        formData.get("customerPhone").trim();

    const customerEmail =
        formData.get("customerEmail").trim();

    const postalCode =
        formData.get("postalCode").trim();

    const addressLine1 =
        formData.get("addressLine1").trim();

    const addressLine2 =
        formData.get("addressLine2").trim();

    const deliveryNote =
        formData.get("deliveryNote").trim();


    document.getElementById("review-name").textContent =
        customerName;

    document.getElementById("review-phone").textContent =
        customerPhone;

    document.getElementById("review-email").textContent =
        customerEmail;

    document.getElementById("review-address").textContent =
        [postalCode, addressLine1, addressLine2]
            .filter(Boolean)
            .join(" / ");

    document.getElementById("review-delivery-note").textContent =
        deliveryNote || "-";


    checkoutForm.hidden = true;
    checkoutReview.hidden = false;

    checkoutReview.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


checkoutForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        if (!checkoutForm.reportValidity()) {
            return;
        }

        const originalButtonText =
            checkoutReviewButton.textContent;

        const couldReviewBeforeCheck =
            checkoutCanReview;

        checkoutCanReview = false;
        checkoutReviewButton.disabled = true;
        checkoutReviewButton.textContent = "CHECKING...";
        checkoutStatusMessage.hidden = true;

        try {

            const latestProducts =
                await loadProductsByIds(getCart());

            renderCheckout(latestProducts);

            if (!checkoutCanReview) {
                return;
            }

            showOrderReview();

        } catch (error) {

            console.error(error);

            checkoutCanReview =
                couldReviewBeforeCheck;
            checkoutStatusMessage.textContent =
                CHECKOUT_RECHECK_ERROR_MESSAGE;
            checkoutStatusMessage.hidden = false;

        } finally {

            checkoutReviewButton.textContent =
                originalButtonText;

            checkoutReviewButton.disabled =
                !checkoutCanReview;

        }

    }
);


checkoutEditButton.addEventListener(
    "click",
    () => {

        checkoutReview.hidden = true;
        checkoutForm.hidden = false;

        checkoutForm.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }
);


loadProductsByIds(getCart())

    .then(products => {

        renderCheckout(products);

    })

    .catch(error => {

        console.error(error);

        checkoutLoading.hidden = true;
        checkoutError.hidden = false;

    });
