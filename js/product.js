const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

fetch("products.json")
    .then(response => response.json())
    .then(products => {

        const product = products.find(item => item.id === productId);

        if (!product) {

            document.body.innerHTML = "<h1>Product not found.</h1>";
            return;

        }

        const productName = document.getElementById("product-name");
        const productPrice = document.getElementById("product-price");
        const productCountry = document.getElementById("product-country");
        const productSize = document.getElementById("product-size");
        const measurementList = document.getElementById("measurement-list");
        const productDescription = document.getElementById("product-description");
        const productNotes = document.getElementById("product-notes");
        const mainImage = document.getElementById("main-image");
        const detailGallery = document.getElementById("detail-gallery");

        productName.textContent = product.name;
        productPrice.textContent = `₩ ${product.price.toLocaleString()}`;
        productCountry.textContent = product.country;
        productSize.textContent = `Size ${product.size}`;
        productDescription.textContent = product.description;

        if (product.notes) {

            const notes = product.notes
                .split("\n")
                .filter(note => note.trim() !== "");

            productNotes.innerHTML = notes.map(note => {

                return `<p>• ${note}</p>`;

            }).join("");

        }

        mainImage.src = `images/products/${product.id}/main.jpg`;
        mainImage.alt = product.name;

        const labels = {

            shoulder: "어깨",
            chest: "가슴",
            length: "총장",
            sleeve: "소매",

            waist: "허리",
            rise: "밑위",
            thigh: "허벅지",
            hem: "밑단",
            inseam: "인심",

            width: "가로",
            height: "세로",
            depth: "폭"

        };
        // 실측 정보 출력
        if (product.measurement) {

            Object.entries(product.measurement).forEach(([key, value]) => {

                // 값이 없으면 출력하지 않음
                if (!value) return;

                measurementList.innerHTML += `

        <div class="measurement-item">

            <span class="measurement-label">

                ${labels[key]}

            </span>

            <span class="measurement-value">

                ${value} cm

            </span>

        </div>

    `;

            });

        }

        // 상세 이미지 출력
        product.images.forEach(image => {

            if (image === "main.jpg") return;

            detailGallery.innerHTML += `

                <img
                    src="images/products/${product.id}/${image}"
                    alt="${product.name}">

            `;

        });

    })
    .catch(error => {

        console.error(error);

    });