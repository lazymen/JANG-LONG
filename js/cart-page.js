const cartList =
    document.getElementById("cart-list");

const cartEmpty =
    document.getElementById("cart-empty");

const cartSummary =
    document.getElementById("cart-summary");

const cartTotal =
    document.getElementById("cart-total");

const checkoutButton =
    document.getElementById("checkout-button");


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

        return;
    }


    cartEmpty.style.display = "none";
    cartSummary.style.display = "block";


    cartList.innerHTML = cartProducts
        .map(product => {

            const gone = isGone(product);

            return `

                <article
                    class="cart-item ${gone ? "gone" : ""}"
                >

                    <a
                        href="product.html?id=${product.id}"
                        class="cart-item-image"
                    >

                        <img
                            src="images/products/${product.id}/main.jpg"
                            alt="${product.name}"
                        >

                    </a>


                    <div class="cart-item-info">

                        <a
                            href="product.html?id=${product.id}"
                            class="cart-item-name"
                        >
                            ${product.name}
                        </a>

                        <p class="cart-item-price">
                            ₩ ${product.price.toLocaleString()}
                        </p>

                        ${gone
                    ? `<p class="cart-item-status">GONE</p>`
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


    const total = availableProducts
        .reduce(
            (sum, product) =>
                sum + product.price,
            0
        );


    cartTotal.textContent =
        `₩ ${total.toLocaleString()}`;


    checkoutButton.disabled =
        availableProducts.length === 0;


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


loadProductsByIds(getCart())

    .then(products => {

        renderCart(products);

    })

    .catch(error => {

        console.error(error);

    });