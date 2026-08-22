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


    const total = availableProducts
        .reduce(
            (sum, product) =>
                sum + product.price,
            0
        );


    cartTotal.textContent =
        `₩ ${total.toLocaleString()}`;


    checkoutButton.disabled =
        availableProducts.length === 0 ||
        hasUnavailableProducts;

    cartCheckoutMessage.hidden =
        !hasUnavailableProducts;


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
