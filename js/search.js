const availableGrid = document.getElementById("available-grid");
const goneGrid = document.getElementById("gone-grid");

const searchQuery = document.getElementById("search-query");
const searchEmpty = document.getElementById("search-empty");

const sectionTitles =
    document.querySelectorAll(
        "body.search-page .search-page-main .section-title"
    );

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

        availableGrid.innerHTML += createProductCard(product);
    });


    gone.forEach(product => {

        goneGrid.innerHTML += createProductCard(product);
    });

    if (products.length === 0) {

        sectionTitles.forEach(title => {
            title.style.display = "none";
        });

        searchEmpty.style.display = "block";

    } else {

        sectionTitles.forEach(title => {
            title.style.display = "";
        });

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


        if (query) {

            searchQuery.textContent =
                `SEARCH : ${query.toUpperCase()}`;

        } else {

            searchQuery.textContent = "";

        }


        renderProducts(
            searchProducts(products, query)
        );

    })

    .catch(error => {

        console.error(error);

    });