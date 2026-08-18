const CART_STORAGE_KEY = "janglong-cart";


function getCart() {

    const savedCart = localStorage.getItem(CART_STORAGE_KEY);

    if (!savedCart) {
        return [];
    }

    try {

        const cart = JSON.parse(savedCart);

        return Array.isArray(cart)
            ? cart
            : [];

    } catch {

        return [];

    }
}


function saveCart(cart) {

    localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
    );

}


function addToCart(productId) {

    const cart = getCart();

    if (cart.includes(productId)) {
        return false;
    }

    cart.push(productId);

    saveCart(cart);

    return true;
}


function removeFromCart(productId) {

    const cart = getCart().filter(
        id => id !== productId
    );

    saveCart(cart);

}


function isInCart(productId) {

    return getCart().includes(productId);

}


function getCartCount() {

    return getCart().length;

}