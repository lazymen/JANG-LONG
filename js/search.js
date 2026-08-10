const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");

const availableGrid = document.getElementById("available-grid");
const goneGrid = document.getElementById("gone-grid");

const searchQuery = document.getElementById("search-query");
const searchEmpty = document.getElementById("search-empty");


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
            : ""
        }

            </div>

            <h3>${product.name}</h3>

            <p>₩ ${product.price.toLocaleString()}</p>

        </a>

    `;

}


function renderProducts(products) {

    availableGrid.innerHTML = "";
    goneGrid.innerHTML = "";

    const available = products.filter(
        product => product.status === "available"
    );

    const gone = products.filter(
        product => product.status === "gone"
    );


    available.forEach(product => {

        availableGrid.innerHTML += createCard(product);

    });


    gone.forEach(product => {

        goneGrid.innerHTML += createCard(product);

    });


    if (products.length === 0) {

        searchEmpty.style.display = "block";

    } else {

        searchEmpty.style.display = "none";

    }

}


function searchProducts(products, query) {

    const keyword = query.toLowerCase().trim();


    if (!keyword) {

        return products;

    }


    return products.filter(product => {

        const searchableText = [

            product.name,
            product.category,
            product.country,
            product.era,
            product.description,
            product.notes

        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        return searchableText.includes(keyword);

    });

}


fetch("products.json")

    .then(response => response.json())

    .then(products => {


        const params = new URLSearchParams(
            window.location.search
        );

        const query = params.get("q") || "";


        searchInput.value = query;


        if (query) {

            searchQuery.textContent =
                `SEARCH : ${query.toUpperCase()}`;

        } else {

            searchQuery.textContent = "";

        }


        renderProducts(
            searchProducts(products, query)
        );


        searchForm.addEventListener("submit", event => {

            event.preventDefault();


            const newQuery =
                searchInput.value.trim();


            if (!newQuery) {

                window.location.href = "search.html";

                return;

            }


            window.location.href =
                `search.html?q=${encodeURIComponent(newQuery)}`;

        });

    })

    .catch(error => {

        console.error(error);

    });