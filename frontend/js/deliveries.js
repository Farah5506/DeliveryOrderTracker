(function () {

    const list = document.getElementById("deliveries-list");
    const template = document.getElementById("delivery-card-template");
    const loading = document.getElementById("deliveries-loading");
    const empty = document.getElementById("deliveries-empty");
    const message = document.getElementById("deliveries-message");

    const failedForm = document.getElementById("failed-form");
    const failedMessage = document.getElementById("failed-message");

    const NEXT_STEPS = {
        assigned: ["picked_up"],
        picked_up: ["on_the_way", "failed"],
        on_the_way: ["delivered", "failed"]
    };


    async function loadDeliveries() {
        show(loading);

        try {
            const data = await apiRequest("/api/deliveries");
            renderDeliveries(data.deliveries || []);
        } catch (err) {
            showError(message, err);
        } finally {
            hide(loading);
        }
    }


    function fill(card, selector, text) {
        card.querySelector(selector).textContent = text || "-";
    }

    function renderDeliveries(deliveries) {
        list.replaceChildren();

        if (deliveries.length === 0) {
            show(empty);
            return;
        }
        hide(empty);

        deliveries.forEach(function (order) {
            const card = template.content.firstElementChild.cloneNode(true);

            fill(card, ".order-number", order.orderNumber);
            setStatusBadge(card.querySelector(".badge"), order.status);
            fill(card, ".card-customer", order.customerName);
            fill(card, ".card-pickup", order.pickupAddress);
            fill(card, ".card-delivery", order.deliveryAddress);
            fill(card, ".card-package", order.packageDetails);
            fill(card, ".card-priority", order.priority === "express" ? "Express" : "Standard");
            fill(card, ".card-notes", order.notes);

            const phone = card.querySelector(".card-phone");
            phone.textContent = order.customerPhone;
            phone.href = "tel:" + order.customerPhone;

            const map = card.querySelector(".map-link");
            if (order.deliveryLat && order.deliveryLon) {
                map.href = mapLink(order.deliveryLat, order.deliveryLon);
            } else {
                map.href = "https://www.google.com/maps/search/?api=1&query=" +
                    encodeURIComponent(order.deliveryAddress);
            }

            const allowed = NEXT_STEPS[order.status] || [];
            card.querySelectorAll("button[data-status]").forEach(function (button) {
                const status = button.dataset.status;

                if (!allowed.includes(status)) {
                    button.remove();
                    return;
                }

                button.addEventListener("click", function () {
                    if (status === "failed") {
                        openFailed(order);
                    } else {
                        updateStatus(order, status, "");
                    }
                });
            });

            list.appendChild(card);
        });
    }


    async function updateStatus(order, status, note) {
        clearMessage(message);

        try {
            await apiRequest("/api/deliveries/" + order.id + "/status", {
                method: "PATCH",
                body: { status: status, note: note }
            });
            showMessage(message, order.orderNumber + " marked as " + formatStatus(status) + ".", "success");
            loadDeliveries();
            return true;
        } catch (err) {
            showError(message, err);
            return false;
        }
    }



    let failedOrder = null;

    function openFailed(order) {
        failedOrder = order;
        clearMessage(failedMessage);
        failedForm.reset();
        document.getElementById("failed-order-number").textContent = order.orderNumber;
        failedForm.orderId.value = order.id;
        openModal("failed-modal");
    }

    failedForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const reason = failedForm.note.value.trim();
        if (reason.length < 3) {
            showMessage(failedMessage, "Please write the reason.", "error");
            return;
        }

        const ok = await updateStatus(failedOrder, "failed", reason);
        if (ok) closeModal("failed-modal");
    });


    document.getElementById("refresh-button").addEventListener("click", loadDeliveries);

    loadDeliveries();

})();