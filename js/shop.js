fetch("products.json")
    .then(response => response.json())
    .then(products => {

        const productGrid = document.querySelector(".product-grid");
        const categoryMenu = document.getElementById("category-menu");

        const categories = [

            "all",

            ...new Set(products.map(product => product.category))

        ];

        // ==========================
        // 상품 출력
        // ==========================

        function renderProducts(productsToRender) {

            productGrid.innerHTML = "";

            productsToRender.forEach(product => {

                productGrid.innerHTML += `

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

            });

        }

        // ==========================
        // 카테고리 버튼 생성
        // ==========================

        categories.forEach(category => {

            const button = document.createElement("button");

            button.className = "category-button";

            const count = category === "all"

                ? products.length

                : products.filter(product => product.category === category).length;

            button.textContent = `${category.toUpperCase()} (${count})`;

            button.addEventListener("click", () => {

                document.querySelectorAll(".category-button").forEach(btn => {

                    btn.classList.remove("active");

                });

                button.classList.add("active");

                if (category === "all") {

                    renderProducts(products);

                } else {

                    const filteredProducts = products.filter(product => {

                        return product.category === category;

                    });

                    renderProducts(filteredProducts);

                }

            });

            categoryMenu.appendChild(button);

        });


        const firstButton = document.querySelector(".category-button");

        if (firstButton) {

            firstButton.classList.add("active");

        }

        renderProducts(products);

    })
    .catch(error => {

        console.error(error);

    });