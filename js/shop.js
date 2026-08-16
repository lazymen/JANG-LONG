loadProducts()
    .then(products => {

        const availableGrid = document.getElementById("available-grid");
        const goneGrid = document.getElementById("gone-grid");
        const categoryMenu = document.getElementById("category-menu");

        const categories = [
            "all",
            ...new Set(products.map(product => product.category))
        ];

        function renderProducts(productsToRender) {

            const available = productsToRender.filter(isAvailable);
            const gone = productsToRender.filter(isGone);

            availableGrid.innerHTML = available
                .map(createProductCard)
                .join("");

            goneGrid.innerHTML = gone
                .map(createProductCard)
                .join("");
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