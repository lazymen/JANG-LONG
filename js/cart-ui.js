function updateCartCount() {

    const cartCount =
        document.getElementById("cart-count");

    if (!cartCount) {
        return;
    }

    cartCount.textContent =
        getCartCount();

}


updateCartCount();