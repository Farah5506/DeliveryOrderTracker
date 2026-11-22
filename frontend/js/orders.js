
(function () {

    const orderForm = document.getElementById("order-form");
    const formMessage = document.getElementById("form-message");

    const filterForm = document.getElementById("filter-form");
    const courierFilter = document.getElementById("filter-courier");
    const ordersBody = document.getElementById("orders-table-body");
    const ordersLoading = document.getElementById("orders-loading");
    const ordersEmpty = document.getElementById("orders-empty");
    const listMessage = document.getElementById("list-message");
    const orderCount = document.getElementById("order-count");

    const editForm = document.getElementById("edit-form");
    const editMessage = document.getElementById("edit-message");

    const STATUSES = ["created", "assigned", "picked_up", "on_the_way", "delivered", "failed", "cancelled"];
    const EDITABLE = ["created", "assigned"];          // before pickup
    const ASSIGNABLE = ["created", "assigned", "failed"];
    const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;



    function readOrderForm(form) {
        return {
            customerName: form.customerName.value.trim(),
            customerPhone: form.customerPhone.value.replace(/[\s-]/g, ""),
            pickupAddress: form.pickupAddress.value.trim(),
            deliveryAddress: form.deliveryAddress.value.trim(),
            packageDetails: form.packageDetails.value.trim(),
            priority: form.priority.value,
            notes: form.notes.value.trim()
        };
    }

    function validateOrder(order) {
        if (order.customerName.length < 2) return "Customer name must be at least 2 characters.";
        if (!PHONE_PATTERN.test(order.customerPhone)) return "Please enter a valid phone number.";
        if (!order.pickupAddress) return "Pickup address is required.";
        if (!order.deliveryAddress) return "Delivery address is required.";
        if (!order.packageDetails) return "Package details are required.";
        return null;
    }

    function addCell(row, text, className) {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (className) cell.className = className;
        row.appendChild(cell);
        return cell;
    }

    function addBadgeCell(row, text, className) {
        const cell = document.createElement("td");
        const badge = document.createElement("span");
        badge.textContent = text;
        badge.className = "badge " + className;
        cell.appendChild(badge);
        row.appendChild(cell);
    }

    function makeButton(text, className, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        if (className) button.className = className;
        button.addEventListener("click", onClick);
        return button;
    }



    orderForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(formMessage);

        const order = readOrderForm(orderForm);
        const problem = validateOrder(order);
        if (problem) {
            showMessage(formMessage, problem, "error");
            return;
        }

        const button = orderForm.querySelector("button[type='submit']");
        button.disabled = true;
        button.textContent = "Creating...";

        try {
            const data = await apiRequest("/api/orders", { method: "POST", body: order });
            const created = data.order || data;

            if (created.addressVerified === false) {
                showMessage(formMessage,
                    "Order " + created.orderNumber + " created, but the address could not be verified.",
                    "warning");
            } else {
                showMessage(formMessage, "Order " + created.orderNumber + " created.", "success");
            }

            orderForm.reset();
            loadOrders();

        } catch (err) {
            showError(formMessage, err);
        } finally {
            button.disabled = false;
            button.textContent = "Create Order";
        }
    });



    async function loadOrders() {
        clearMessage(listMessage);
        show(ordersLoading);

        const params = new URLSearchParams();
        new FormData(filterForm).forEach(function (value, key) {
            if (value) params.append(key, value);
        });

        const query = params.toString() ? "?" + params.toString() : "";

        try {
            const data = await apiRequest("/api/orders" + query);
            const orders = data.orders || [];
            renderOrders(orders);
            renderCounts(data.counts, orders);
        } catch (err) {
            showError(listMessage, err);
        } finally {
            hide(ordersLoading);
        }
    }

    function renderOrders(orders) {
        ordersBody.replaceChildren();
        orderCount.textContent = orders.length;

        if (orders.length === 0) {
            show(ordersEmpty);
            return;
        }
        hide(ordersEmpty);

        orders.forEach(function (order) {
            const row = document.createElement("tr");

            addCell(row, order.orderNumber, "order-number");
            addCell(row, order.customerName);
            addCell(row, order.deliveryAddress);
            addBadgeCell(row, order.priority === "express" ? "Express" : "Standard", "badge-" + order.priority);
            addBadgeCell(row, formatStatus(order.status), "status-" + order.status);
            addCell(row, order.courierName || "-");
            addCell(row, formatDate(order.createdAt));

            const actions = addCell(row, "", "actions");

            actions.appendChild(makeButton("View", "btn-secondary", function () {
                openDetails(order.id);
            }));

            if (EDITABLE.includes(order.status)) {
                actions.appendChild(makeButton("Edit", "", function () {
                    openEdit(order);
                }));
                actions.appendChild(makeButton("Cancel", "btn-danger", function () {
                    cancelOrder(order);
                }));
            }

            if (ASSIGNABLE.includes(order.status) && typeof window.openAssignModal === "function") {
                actions.appendChild(makeButton(order.courierId ? "Reassign" : "Assign", "btn-success", function () {
                    window.openAssignModal(order);
                }));
            }

            ordersBody.appendChild(row);
        });
    }

    function renderCounts(counts, orders) {
        STATUSES.forEach(function (status) {
            let value;
            if (counts && counts[status] !== undefined) {
                value = counts[status];
            } else {
                value = orders.filter(function (o) { return o.status === status; }).length;
            }
            document.getElementById("count-" + status).textContent = value;
        });
    }

    async function loadCourierFilter() {
        try {
            const data = await apiRequest("/api/couriers");
            (data.couriers || []).forEach(function (courier) {
                const option = document.createElement("option");
                option.value = courier.id;
                option.textContent = courier.fullName;
                courierFilter.appendChild(option);
            });
        } catch (err) {
        }
    }

    filterForm.addEventListener("submit", function (event) {
        event.preventDefault();
        loadOrders();
    });



    function setText(id, text) {
        document.getElementById(id).textContent = text || "-";
    }

    async function openDetails(id) {
        try {
            const data = await apiRequest("/api/orders/" + id);
            const order = data.order || data;

            setText("details-order-number", order.orderNumber);
            setStatusBadge(document.getElementById("details-status"), order.status);
            setText("details-customer", order.customerName);
            setText("details-phone", order.customerPhone);
            setText("details-pickup", order.pickupAddress);
            setText("details-delivery", order.deliveryAddress);
            setText("details-verified", order.addressVerified ? "Verified" : "Not verified");
            setText("details-package", order.packageDetails);
            setText("details-priority", order.priority === "express" ? "Express" : "Standard");
            setText("details-courier", order.courierName);
            setText("details-notes", order.notes);

            const link = document.getElementById("details-map-link");
            if (order.deliveryLat && order.deliveryLon) {
                link.href = mapLink(order.deliveryLat, order.deliveryLon);
                show(link);
            } else {
                hide(link);
            }

            const timeline = document.getElementById("details-timeline");
            timeline.replaceChildren();

            const historyData = await apiRequest("/api/deliveries/" + id + "/history");
            (historyData.history || []).forEach(function (entry) {
                const item = document.createElement("li");

                const title = document.createElement("strong");
                title.textContent = formatStatus(entry.toStatus);
                item.appendChild(title);

                const time = document.createElement("span");
                time.className = "time";
                time.textContent = formatDate(entry.createdAt) +
                    (entry.changedByName ? " by " + entry.changedByName : "");
                item.appendChild(time);

                if (entry.note) {
                    const note = document.createElement("span");
                    note.className = "note";
                    note.textContent = entry.note;
                    item.appendChild(note);
                }

                timeline.appendChild(item);
            });

            openModal("details-modal");

        } catch (err) {
            showError(listMessage, err);
        }
    }



    function openEdit(order) {
        clearMessage(editMessage);

        document.getElementById("edit-order-number").textContent = order.orderNumber;
        editForm.id.value = order.id;
        editForm.customerName.value = order.customerName || "";
        editForm.customerPhone.value = order.customerPhone || "";
        editForm.pickupAddress.value = order.pickupAddress || "";
        editForm.deliveryAddress.value = order.deliveryAddress || "";
        editForm.packageDetails.value = order.packageDetails || "";
        editForm.priority.value = order.priority || "standard";
        editForm.notes.value = order.notes || "";

        openModal("edit-modal");
    }

    editForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(editMessage);

        const changes = readOrderForm(editForm);
        const problem = validateOrder(changes);
        if (problem) {
            showMessage(editMessage, problem, "error");
            return;
        }

        try {
            await apiRequest("/api/orders/" + editForm.id.value, { method: "PATCH", body: changes });
            closeModal("edit-modal");
            showMessage(listMessage, "Order updated.", "success");
            loadOrders();
        } catch (err) {
            showError(editMessage, err);
        }
    });



    async function cancelOrder(order) {
        if (!confirm("Cancel order " + order.orderNumber + "?")) return;

        try {
            await apiRequest("/api/orders/" + order.id + "/cancel", { method: "PATCH" });
            showMessage(listMessage, "Order " + order.orderNumber + " cancelled.", "success");
            loadOrders();
        } catch (err) {
            showError(listMessage, err);
        }
    }


    document.addEventListener("orders:changed", loadOrders);


    loadCourierFilter();
    loadOrders();

})();