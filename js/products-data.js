const JANG_LONG_SUPABASE_URL = "https://fdjzdjeqclkcssxrwnrk.supabase.co";
const JANG_LONG_SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_w5vIvrXR3KjqHkOgzxdhhQ__W9xst6O";

const JANG_LONG_PRODUCT_IMAGES_BUCKET = "product-images";

const JANG_LONG_IMAGE_PRODUCT_ID_PATTERN = /^[0-9]{4}$/;

const JANG_LONG_LEGACY_IMAGE_PATH_PATTERN =
    /^images\/products\/[0-9]{4}\/[A-Za-z0-9._-]+$/;

const JANG_LONG_STORAGE_IMAGE_PATH_PATTERN =
    /^[0-9]{4}\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

const JANG_LONG_IMAGE_FILE_NAME_PATTERN =
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function getStorageProductImageUrl(imagePath) {
    const encodedPath = imagePath
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    return (
        `${JANG_LONG_SUPABASE_URL}` +
        `/storage/v1/object/public/` +
        `${JANG_LONG_PRODUCT_IMAGES_BUCKET}/` +
        encodedPath
    );
}

function getStoredProductImageUrl(imagePath) {
    const normalizedImagePath =
        typeof imagePath === "string"
            ? imagePath.trim()
            : "";

    if (
        JANG_LONG_LEGACY_IMAGE_PATH_PATTERN.test(
            normalizedImagePath,
        )
    ) {
        return normalizedImagePath;
    }

    if (
        JANG_LONG_STORAGE_IMAGE_PATH_PATTERN.test(
            normalizedImagePath,
        )
    ) {
        return getStorageProductImageUrl(
            normalizedImagePath,
        );
    }

    return "";
}

function getProductImageUrl(productId, imagePath) {
    const normalizedProductId =
        typeof productId === "string"
            ? productId.trim()
            : "";

    const normalizedImagePath =
        typeof imagePath === "string"
            ? imagePath.trim()
            : "";

    if (
        !JANG_LONG_IMAGE_PRODUCT_ID_PATTERN.test(
            normalizedProductId,
        )
    ) {
        return "";
    }

    const storedImageUrl =
        getStoredProductImageUrl(normalizedImagePath);

    if (storedImageUrl) {
        const storageProductId =
            normalizedImagePath.split("/")[0];

        if (
            JANG_LONG_STORAGE_IMAGE_PATH_PATTERN.test(
                normalizedImagePath,
            ) &&
            storageProductId !== normalizedProductId
        ) {
            return "";
        }

        return storedImageUrl;
    }

    if (
        !JANG_LONG_IMAGE_FILE_NAME_PATTERN.test(
            normalizedImagePath
        )
    ) {
        return "";
    }

    return (
        `images/products/` +
        `${normalizedProductId}/` +
        normalizedImagePath
    );
}

function getProductMainImageUrl(product) {
    const images = Array.isArray(product?.images)
        ? product.images
        : [];

    const mainImagePath =
        images.find((imagePath) => {
            return String(imagePath)
                .split("/")
                .pop()
                ?.toLowerCase() === "main.jpg";
        }) || images[0];

    return getProductImageUrl(
        product?.id,
        mainImagePath,
    );
}

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