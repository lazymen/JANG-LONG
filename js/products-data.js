const JANG_LONG_SUPABASE_URL = "https://fdjzdjeqclkcssxrwnrk.supabase.co";
const JANG_LONG_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_w5vIvrXR3KjqHkOgzxdhhQ__W9xst6O";

const JANG_LONG_PRODUCTS_ENDPOINT =
    `${JANG_LONG_SUPABASE_URL}/rest/v1/products` +
    "?select=id,name,price,size,country,era,status,category,description,notes,measurement,images" +
    "&order=id.asc";

async function loadProducts() {
    const response = await fetch(JANG_LONG_PRODUCTS_ENDPOINT, {
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

function findProductById(products, productId) {
    return products.find(product => product.id === productId);
}