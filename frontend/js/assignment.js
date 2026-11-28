(function () {

    const assignForm = document.getElementById("assign-form");
    const assignSelect = document.getElementById("assign-courier");
    const assignMessage = document.getElementById("assign-message");
    const unassignButton = document.getElementById("unassign-button");

    let currentOrder = null;

    function ordersChanged() {
        document.dispatchEvent(new Event("orders:changed"));
    }

    function assignmentPath(order) {
        return "/api/orders/" + encodeURIComponent(order.id) + "/assignment";
    }

    async function openAssignModal(order) {
        currentOrder = order;
        clearMessage(assignMessage);

        document.getElementById("assign-order-number").textContent = order.orderNumber;
        assignForm.orderId.value = order.id;

        if (order.courierId && order.status === "assigned") {
            show(unassignButton);
        } else {
            hide(unassignButton);
        }

        assignSelect.replaceChildren();
        const first = document.createElement("option");
        first.value = "";
        first.textContent = "Select courier";
        assignSelect.appendChild(first);

        try {
            const data = await apiRequest("/api/couriers?availability=available");
            const couriers = (data.couriers || []).filter(function (c) {
                return c.isActive && c.id !== order.courierId;
            });

            couriers.forEach(function (courier) {
                const option = document.createElement("option");
                option.value = courier.id;
                option.textContent = courier.fullName + " (" + (courier.activeOrders || 0) + " active)";
                assignSelect.appendChild(option);
            });

            if (couriers.length === 0) {
                showMessage(assignMessage, "No available couriers right now.", "warning");
            }
        } catch (err) {
            showError(assignMessage, err);
        }

        openModal("assign-modal");
    }

    window.openAssignModal = openAssignModal;


    assignForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(assignMessage);

        const courierId = assignSelect.value;
        if (!courierId) {
            showMessage(assignMessage, "Please choose a courier.", "error");
            return;
        }

        try {
            await apiRequest(assignmentPath(currentOrder), {
                method: "PATCH",
                body: { courierId: courierId }
            });
            closeModal("assign-modal");
            ordersChanged();
        } catch (err) {
            showError(assignMessage, err);
        }
    });


    unassignButton.addEventListener("click", async function () {
        clearMessage(assignMessage);

        try {
            await apiRequest(assignmentPath(currentOrder), { method: "DELETE" });
            closeModal("assign-modal");
            ordersChanged();
        } catch (err) {
            showError(assignMessage, err);
        }
    });

})();