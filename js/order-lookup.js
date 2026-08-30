(() => {
    const form = document.getElementById("order-lookup-form");

    if (!form) {
        return;
    }

    const lookupPanel = document.getElementById(
        "order-lookup-panel",
    );
    const result = document.getElementById("order-result");
    const orderNumberInput = document.getElementById("order-number");
    const emailInput = document.getElementById("order-email");
    const lookupButton = document.getElementById(
        "order-lookup-button",
    );
    const message = document.getElementById(
        "order-lookup-message",
    );
    const lookupAgainButton = document.getElementById(
        "order-lookup-again",
    );

    const resultNumber = document.getElementById(
        "order-result-number",
    );

    const copyOrderNumberButton = document.getElementById(
        "order-result-number-copy",
    );

    const resultDate = document.getElementById(
        "order-result-date",
    );
    const resultStatus = document.getElementById(
        "order-result-status",
    );
    const resultShippingStatus = document.getElementById(
        "order-result-shipping-status",
    );
    const resultItems = document.getElementById(
        "order-result-items",
    );
    const resultSubtotal = document.getElementById(
        "order-result-subtotal",
    );
    const resultShippingFee = document.getElementById(
        "order-result-shipping-fee",
    );
    const resultTotal = document.getElementById(
        "order-result-total",
    );
    const resultRecipient = document.getElementById(
        "order-result-recipient",
    );
    const resultAddress = document.getElementById(
        "order-result-address",
    );
    const resultDeliveryNote = document.getElementById(
        "order-result-delivery-note",
    );
    const resultCarrier = document.getElementById(
        "order-result-carrier",
    );
    const resultTrackingNumber = document.getElementById(
        "order-result-tracking-number",
    );

    const ORDER_NUMBER_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const ORDER_STATUS_LABELS = {
        reserved: "RESERVED",
        pending: "PENDING",
        pending_payment: "PENDING PAYMENT",
        paid: "PAID",
        cancelled: "CANCELLED",
        expired: "EXPIRED",
        refunded: "REFUNDED",
    };

    const SHIPPING_STATUS_LABELS = {
        pending: "PREPARING",
        preparing: "PREPARING",
        ready: "READY TO SHIP",
        shipped: "SHIPPED",
        delivered: "DELIVERED",
        cancelled: "CANCELLED",
    };

    const LOOKUP_URL =
        `${JANG_LONG_SUPABASE_URL}/functions/v1/lookup-guest-order`;

    function setText(element, value) {
        if (!element) {
            return;
        }

        element.textContent = value || "—";
    }

    function showMessage(text) {
        if (!message) {
            return;
        }

        message.textContent = text;
        message.hidden = false;
    }

    function hideMessage() {
        if (!message) {
            return;
        }

        message.textContent = "";
        message.hidden = true;
    }

    function formatAmount(value, currency) {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
            return "—";
        }

        const formattedAmount =
            new Intl.NumberFormat("ko-KR").format(amount);

        if (currency === "KRW") {
            return `₩ ${formattedAmount}`;
        }

        return `${currency || ""} ${formattedAmount}`.trim();
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(date);
    }

    function formatStatus(value, labels) {
        if (!value) {
            return "—";
        }

        return (
            labels[value] ||
            String(value)
                .replaceAll("_", " ")
                .toUpperCase()
        );
    }

    function renderItems(items, currency) {
        if (!resultItems) {
            return;
        }

        resultItems.replaceChildren();

        if (!Array.isArray(items) || items.length === 0) {
            const empty = document.createElement("p");

            empty.textContent = "ORDER ITEM INFORMATION IS UNAVAILABLE.";

            resultItems.append(empty);

            return;
        }

        items.forEach((item) => {
            const row = document.createElement("article");

            row.className = "order-result-item";

            if (item.imagePath) {
                const image = document.createElement("img");

                image.className = "order-result-item-image";
                image.src = item.imagePath;
                image.alt = item.productName || "ORDER ITEM";
                image.loading = "lazy";

                image.addEventListener("error", () => {
                    image.remove();
                });

                row.append(image);
            }

            const information = document.createElement("div");

            information.className = "order-result-item-information";

            const name = document.createElement("p");

            name.className = "order-result-item-name";
            name.textContent = item.productName || "UNKNOWN ITEM";

            const size = document.createElement("p");

            size.className = "order-result-item-size";
            size.textContent = item.size
                ? `SIZE ${item.size}`
                : "SIZE —";

            const price = document.createElement("p");

            price.className = "order-result-item-price";
            price.textContent = formatAmount(
                item.unitPrice,
                currency,
            );

            information.append(name, size, price);
            row.append(information);
            resultItems.append(row);
        });
    }

    function renderOrder(order) {
        const totals = order.totals || {};
        const shipping = order.shipping || {};

        setText(resultNumber, order.orderNumber);
        setText(resultDate, formatDate(order.orderedAt));
        setText(
            resultStatus,
            formatStatus(order.status, ORDER_STATUS_LABELS),
        );
        setText(
            resultShippingStatus,
            formatStatus(
                shipping.status,
                SHIPPING_STATUS_LABELS,
            ),
        );

        setText(
            resultSubtotal,
            formatAmount(totals.subtotal, totals.currency),
        );
        setText(
            resultShippingFee,
            formatAmount(totals.shippingFee, totals.currency),
        );

        const calculatedTotal =
            totals.totalAmount ??
            Number(totals.subtotal || 0) +
            Number(totals.shippingFee || 0);

        setText(
            resultTotal,
            formatAmount(calculatedTotal, totals.currency),
        );

        setText(resultRecipient, shipping.recipientName);

        const address = [
            shipping.postalCode
                ? `(${shipping.postalCode})`
                : "",
            shipping.addressLine1,
            shipping.addressLine2,
        ]
            .filter(Boolean)
            .join(" ");

        setText(resultAddress, address);
        setText(resultDeliveryNote, shipping.deliveryNote);
        setText(resultCarrier, shipping.carrier);
        setText(resultTrackingNumber, shipping.trackingNumber);

        renderItems(order.items, totals.currency);

        lookupPanel.hidden = true;
        result.hidden = false;
    }

    async function requestOrder(orderNumber, email) {
        const response = await fetch(LOOKUP_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: JANG_LONG_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
                orderNumber,
                email,
            }),
        });

        let payload;

        try {
            payload = await response.json();
        } catch {
            throw new Error(
                "주문 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
            );
        }

        if (!response.ok || !payload?.ok) {
            throw new Error(
                payload?.error?.message ||
                "주문 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
            );
        }

        return payload.order;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const orderNumber =
            orderNumberInput.value.trim().toUpperCase();
        const email = emailInput.value.trim().toLowerCase();

        if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
            showMessage("주문번호를 확인해주세요.");

            orderNumberInput.focus();

            return;
        }

        if (!EMAIL_PATTERN.test(email)) {
            showMessage("이메일 주소를 확인해주세요.");

            emailInput.focus();

            return;
        }

        hideMessage();

        lookupButton.disabled = true;
        lookupButton.textContent = "SEARCHING...";

        try {
            const order = await requestOrder(orderNumber, email);

            renderOrder(order);
        } catch (error) {
            showMessage(
                error instanceof Error
                    ? error.message
                    : "주문 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
            );
        } finally {
            lookupButton.disabled = false;
            lookupButton.textContent = "FIND ORDER";
        }
    });

    copyOrderNumberButton?.addEventListener(
        "click",
        async () => {
            const orderNumber =
                resultNumber?.textContent?.trim() || "";

            if (!orderNumber || orderNumber === "—") {
                return;
            }

            try {
                await navigator.clipboard.writeText(orderNumber);

                copyOrderNumberButton.textContent = "COPIED";

                window.setTimeout(() => {
                    copyOrderNumberButton.textContent = "COPY";
                }, 1500);
            } catch {
                copyOrderNumberButton.textContent = "TRY AGAIN";

                window.setTimeout(() => {
                    copyOrderNumberButton.textContent = "COPY";
                }, 1500);
            }
        },
    );

    lookupAgainButton.addEventListener("click", () => {
        result.hidden = true;
        lookupPanel.hidden = false;

        form.reset();
        hideMessage();

        orderNumberInput.focus();
    });
})();