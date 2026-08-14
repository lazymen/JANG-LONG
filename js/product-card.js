function createProductCard(product) {

    return `

        <a
            href="product.html?id=${product.id}"
            class="product-card ${isGone(product) ? "gone" : ""}"
        >

            <div class="product-image-wrapper">

                <img
                    src="images/products/${product.id}/main.jpg"
                    alt="${product.name}"
                >

              ${isGone(product)
            ? `<div class="gone-badge">GONE</div>`
            : ""
        }

            </div>

            <h3>${product.name}</h3>

            <p>₩ ${product.price.toLocaleString()}</p>

        </a>

    `;
}