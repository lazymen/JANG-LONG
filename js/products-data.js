function loadProducts() {
    return fetch("products.json")
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to load products.json");
            }

            return response.json();
        });
}

function findProductById(products, productId) {
    return products.find(product => product.id === productId);
}