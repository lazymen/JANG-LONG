const JANG_LONG_SUPABASE_URL = "https://fdjzdjeqclkcssxrwnrk.supabase.co";
const JANG_LONG_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_w5vIvrXR3KjqHkOgzxdhhQ__W9xst6O";

const JANG_LONG_PRODUCTS_ENDPOINT =
    `${JANG_LONG_SUPABASE_URL}/rest/v1/products` +
    "?select=id,name,price,size,country,era,status,category,description,notes,measurement,images" +
    "&is_published=eq.true" +
    "&order=id.asc";

async function requestProducts(endpoint) {
    const response = await fetch(endpoint, {
        headers: {
            apikey: JANG_LONG_SUPABASE_PUBLISHABLE_KEY
        }
    });

    if (!response.ok) {
        throw new Error(
            `Failed to load products from Supabase (${response.status})`
        );
    }

    return response.json();
}

async function loadProducts() {
    return requestProducts(JANG_LONG_PRODUCTS_ENDPOINT);
}

async function loadProductsByIds(productIds) {
    const validProductIds = [...new Set(productIds)]
        .filter(productId =>
            typeof productId === "string" &&
            /^[0-9]{4}$/.test(productId)
        );

    if (validProductIds.length === 0) {
        return [];
    }

    const productIdsFilter = validProductIds
        .map(encodeURIComponent)
        .join(",");

    const endpoint =
        `${JANG_LONG_PRODUCTS_ENDPOINT}` +
        `&id=in.(${productIdsFilter})`;

    return requestProducts(endpoint);
}

function findProductById(products, productId) {
    return products.find(product => product.id === productId);
}