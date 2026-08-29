const cartList =
    document.getElementById("cart-list");

const cartEmpty =
    document.getElementById("cart-empty");

const cartSummary =
    document.getElementById("cart-summary");

const cartTotal =
    document.getElementById("cart-total");

const cartCheckoutMessage =
    document.getElementById("cart-checkout-message");

const checkoutButton =
    document.getElementById("checkout-button");

const RESERVATION_SESSION_KEY =
    "janglong-guest-checkout-reservation-v1";

const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

const PRODUCT_ID_PATTERN = /^[0-9]{4}$/;

const UNAVAILABLE_CHECKOUT_MESSAGE =
    "구매할 수 없는 상품이 포함되어 있습니다. 해당 상품을 삭제한 뒤 다시 진행해주세요.";

const RESERVATION_RETURN_MESSAGE =
    "예약이 진행 중입니다. 예약 화면으로 돌아가 남은 시간을 확인해주세요.";


function escapeCartHtml(value) {

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

function getMatchingReservationSession(cartIds) {

    const productIds = [...new Set(cartIds)]

        .filter(productId =>
            PRODUCT_ID_PATTERN.test(productId)
        );

    const signature =
        JSON.stringify(productIds.sort());

    try {

        const session = JSON.parse(
            localStorage.getItem(
                RESERVATION_SESSION_KEY
            )
        );

        const isValidSession =
            session &&
            typeof session === "object" &&
            typeof session.cartSignature === "string" &&
            session.cartSignature === signature &&
            typeof session.checkoutToken === "string" &&
            TOKEN_PATTERN.test(session.checkoutToken) &&
            typeof session.recoveryToken === "string" &&
            TOKEN_PATTERN.test(session.recoveryToken);

        return isValidSession
            ? session
            : null;

    } catch {

        return null;

    }

}


function renderCart(products) {

    const cartIds = removeMissingProductsFromCart(products);

    updateCartCount();


    const cartProducts = cartIds
        .map(productId =>
            findProductById(products, productId)
        )
        .filter(Boolean);


    if (cartProducts.length === 0) {

        cartList.innerHTML = "";

        cartEmpty.style.display = "block";
        cartSummary.style.display = "none";
        cartCheckoutMessage.hidden = true;

        return;
    }


    cartEmpty.style.display = "none";
    cartSummary.style.display = "block";


    cartList.innerHTML = cartProducts
        .map(product => {

            const gone = isGone(product);
            const reserved = product.status === "reserved";

            const safeProductName =
                escapeCartHtml(product.name);

            const statusLabel = gone
                ? "GONE"
                : reserved
                    ? "RESERVED"
                    : "";

            return `

                <article
                    class="cart-item ${gone ? "gone" : ""} ${reserved ? "reserved" : ""}"
                >

                    <a
                        href="product.html?id=${product.id}"
                        class="cart-item-image"
                    >

                        <img
                            src="images/products/${product.id}/main.jpg"
                            alt="${safeProductName}"
                        >

                    </a>


                    <div class="cart-item-info">

                        <a
                            href="product.html?id=${product.id}"
                            class="cart-item-name"
                        >
                            ${safeProductName}
                        </a>

                        <p class="cart-item-price">
                            ₩ ${product.price.toLocaleString()}
                        </p>

                        ${statusLabel
                    ? `<p class="cart-item-status">${statusLabel}</p>`
                    : ""
                }

                        <button
                            type="button"
                            class="cart-remove"
                            data-product-id="${product.id}"
                        >
                            REMOVE
                        </button>

                    </div>

                </article>

            `;

        })
        .join("");


    const availableProducts =
        cartProducts.filter(isAvailable);

    const hasUnavailableProducts =
        availableProducts.length !== cartProducts.length;

    const reservationSession =
        getMatchingReservationSession(cartIds);

    const canReturnToReservation =
        Boolean(reservationSession) &&
        cartProducts.every(product =>
            product.status === "reserved"
        );


    const total = availableProducts
        .reduce(
            (sum, product) =>
                sum + product.price,
            0
        );


    cartTotal.textContent =
        `₩ ${total.toLocaleString()}`;


    if (canReturnToReservation) {

        checkoutButton.disabled = false;
        
        checkoutButton.textContent =
            "RETURN TO RESERVATION";

        cartCheckoutMessage.textContent =
            RESERVATION_RETURN_MESSAGE;

        cartCheckoutMessage.hidden = false;

    } else {

        checkoutButton.disabled =
            availableProducts.length === 0 ||
            hasUnavailableProducts;

        checkoutButton.textContent =
            "CHECKOUT";

        cartCheckoutMessage.textContent =
            UNAVAILABLE_CHECKOUT_MESSAGE;

        cartCheckoutMessage.hidden =
            !hasUnavailableProducts;

    }


    document
        .querySelectorAll(".cart-remove")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const productId =
                        button.dataset.productId;

                    removeFromCart(productId);

                    updateCartCount();

                    renderCart(products);

                }
            );

        });

}


checkoutButton.addEventListener(
    "click",
    () => {

        if (!checkoutButton.disabled) {
            window.location.href = "checkout.html";
        }

    }
);


loadProductsByIds(getCart())

    .then(products => {

        renderCart(products);

    })

    .catch(error => {

        console.error(error);

    });
