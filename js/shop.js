fetch("products.json")
    .then(response => response.json())
    .then(products => {

        const availableGrid = document.getElementById("available-grid");
        const goneGrid = document.getElementById("gone-grid");
        const categoryMenu = document.getElementById("category-menu");

        const categories = [
            "all",
            ...new Set(products.map(product => product.category))
        ];

        function createCard(product) {

            return `

            <a href="product.html?id=${product.id}"
               class="product-card ${product.status === "gone" ? "gone" : ""}">

                <div class="product-image-wrapper">

                    <img
                        src="images/products/${product.id}/main.jpg"
                        alt="${product.name}">

                    ${product.status === "gone"
                        ? `<div class="gone-badge">GONE</div>`
                        : ""}

                </div>

                <h3>${product.name}</h3>

                <p>₩ ${product.price.toLocaleString()}</p>

            </a>

            `;

        }

        function renderProducts(productsToRender) {

            availableGrid.innerHTML = "";
            goneGrid.innerHTML = "";

            const available =
                productsToRender.filter(product => product.status === "available");

            const gone =
                productsToRender.filter(product => product.status === "gone");

            available.forEach(product => {
                availableGrid.innerHTML += createCard(product);
            });

            gone.forEach(product => {
                goneGrid.innerHTML += createCard(product);
            });

        }

        categories.forEach(category => {

            const button = document.createElement("button");

            button.className = "category-button";

            const count = category === "all"
                ? products.length
                : products.filter(product => product.category === category).length;

            button.textContent =
                `${category.toUpperCase()} (${count})`;

            button.addEventListener("click", () => {

                document.querySelectorAll(".category-button").forEach(btn => {

                    btn.classList.remove("active");

                });

                button.classList.add("active");

                if (category === "all") {

                    renderProducts(products);

                } else {

                    renderProducts(

                        products.filter(product =>
                            product.category === category
                        )

                    );

                }

            });

            categoryMenu.appendChild(button);

        });

        document
            .querySelector(".category-button")
            .classList.add("active");

        renderProducts(products);

    })
    .catch(error => {

        console.error(error);

    });