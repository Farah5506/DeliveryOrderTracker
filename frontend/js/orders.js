(function () {

    const orderForm = document.getElementById("order-form");
    const orderFormMessage = document.getElementById("order-form-message");

    const filterForm = document.getElementById("order-filter-form");
    const courierFilter = document.getElementById("order-courier-filter");
    const ordersBody = document.getElementById("orders-list");
    const ordersLoading = document.getElementById("orders-loading");
    const ordersEmpty = document.getElementById("orders-empty");
    const orderCount = document.getElementById("order-count");
    const ordersMessage = document.getElementById("orders-message");

    const editForm = document.getElementById("order-edit-form");
    const editMessage = document.getElementById("edit-order-message");

    const detailMessage = document.getElementById("detail-message");
    const historyList = document.getElementById("detail-history");

    const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

    // Same rules the API enforces (the API is the real check).
    const EDITABLE = ["created", "assigned"];
    const CANCELLABLE = ["created", "assigned"];
    const ASSIGNABLE = ["created", "assigned", "failed"];

    const FIELDS = ["customerName", "customerPhone", "pickupAddress",
                    "deliveryAddress", "packageDetails", "notes"];


    // ---------- helpers ----------

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
        if (!PHONE_PATTERN.test(order.customerPhone)) return "Please enter a valid phone number (10 to 15 digits).";
        if (order.pickupAddress.length < 5) return "Please enter the full pickup address.";
        if (order.deliveryAddress.length < 5) return "Please enter the full delivery address.";
        if (order.packageDetails.length < 2) return "Please describe the package.";
        if (order.priority !== "standard" && order.priority !== "express") return "Please choose a priority.";
        if (order.notes.length > 500) return "Notes must be 500 characters or less.";
        return null;
    }

    function addCell(row, text) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.appendChild(cell);
        return cell;
    }

    function addButton(container, label, className, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = "btn-small " + (className || "");
        button.addEventListener("click", onClick);
        container.appendChild(button);
    }

    function setText(id, text) {
        document.getElementById(id).textContent = text || "-";
    }

    function orderPath(order) {
        return "/api/orders/" + encodeURIComponent(order.id);
    }


    // ---------- create order ----------

    orderForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(orderFormMessage);

        const order = readOrderForm(orderForm);
        const problem = validateOrder(order);
        if (problem) return showMessage(orderFormMessage, problem, "error");

        const button = orderForm.querySelector("button[type='submit']");
        button.disabled = true;

        try {
            const data = await apiRequest("/api/orders", { method: "POST", body: order });
            const created = data.order || data;

            if (created.addressVerified === false) {
                showMessage(orderFormMessage,
                    "Order " + created.orderNumber + " created, but the delivery address could not be found on the map. Please double-check it.",
                    "warning");
            } else {
                showMessage(orderFormMessage, "Order " + created.orderNumber + " created.", "success");
            }

            orderForm.reset();
            loadOrders();
        } catch (err) {
            showError(orderFormMessage, err);
        } finally {
            button.disabled = false;
        }
    });


    // ---------- list, search and filter ----------

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
            // The other filters still work without the courier list.
        }
    }

    async function loadOrders() {
        show(ordersLoading);

        const params = new URLSearchParams();
        new FormData(filterForm).forEach(function (value, key) {
            if (value) params.append(key, value);
        });
        const query = params.toString() ? "?" + params.toString() : "";

        try {
            const data = await apiRequest("/api/orders" + query);
            renderOrders(data.orders || []);
        } catch (err) {
            showError(ordersMessage, err);
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

            addCell(row, order.orderNumber).className = "order-number";
            addCell(row, order.customerName);
            addCell(row, order.deliveryAddress);

            const statusCell = document.createElement("td");
            const badge = document.createElement("span");
            setStatusBadge(badge, order.status);
            statusCell.appendChild(badge);
            row.appendChild(statusCell);

            addCell(row, order.courierName || "-");
            addCell(row, formatDate(order.createdAt));

            const actions = addCell(row, "");
            actions.className = "actions";

            addButton(actions, "View", "btn-secondary", function () {
                openDetail(order);
            });

            if (EDITABLE.includes(order.status)) {
                addButton(actions, "Edit", "btn-secondary", function () {
                    openEdit(order);
                });
            }

            if (ASSIGNABLE.includes(order.status)) {
                addButton(actions, order.status === "created" ? "Assign" : "Reassign", "", function () {
                    window.openAssignModal(order);
                });
            }

            if (CANCELLABLE.includes(order.status)) {
                addButton(actions, "Cancel", "btn-danger", function () {
                    cancelOrder(order);
                });
            }

            ordersBody.appendChild(row);
        });
    }

    filterForm.addEventListener("submit", function (event) {
        event.preventDefault();
        clearMessage(ordersMessage);
        loadOrders();
    });

    filterForm.addEventListener("reset", function () {
        // the form clears its fields after this event, so reload right after
        setTimeout(loadOrders, 0);
    });

    // assignment.js fires this after an assign or unassign
    document.addEventListener("orders:changed", function () {
        showMessage(ordersMessage, "Courier assignment updated.", "success");
        loadOrders();
    });


    // ---------- view details + status history ----------

    function fillDetail(order) {
        setText("detail-order-number", order.orderNumber);
        setStatusBadge(document.getElementById("detail-status"), order.status);
        setText("detail-customer", order.customerName);
        setText("detail-phone", order.customerPhone);
        setText("detail-pickup", order.pickupAddress);
        setText("detail-delivery", order.deliveryAddress);
        document.getElementById("detail-verified").textContent =
            order.addressVerified === false ? " (address not verified on map)" : "";
        setText("detail-package", order.packageDetails);
        setText("detail-priority", order.priority === "express" ? "Express" : "Standard");
        setText("detail-notes", order.notes);
        setText("detail-courier", order.courierName);
        setText("detail-created", formatDate(order.createdAt));

        const map = document.getElementById("detail-map");
        if (order.deliveryLat && order.deliveryLon) {
            map.href = mapLink(order.deliveryLat, order.deliveryLon);
        } else {
            map.href = "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(order.deliveryAddress || "");
        }
    }

    function renderHistory(history) {
        historyList.replaceChildren();

        if (history.length === 0) {
            const item = document.createElement("li");
            item.textContent = "No history yet.";
            historyList.appendChild(item);
            return;
        }

        history.forEach(function (entry) {
            const item = document.createElement("li");

            const title = document.createElement("strong");
            title.textContent = formatStatus(entry.toStatus || entry.status);
            item.appendChild(title);

            const time = document.createElement("span");
            time.className = "time";
            time.textContent = formatDate(entry.createdAt) +
                (entry.changedByName ? " by " + entry.changedByName : "");
            item.appendChild(time);

            if (entry.note) {
                const note = document.createElement("p");
                note.className = "note";
                note.textContent = entry.note;
                item.appendChild(note);
            }

            historyList.appendChild(item);
        });
    }

    async function openDetail(order) {
        clearMessage(detailMessage);
        fillDetail(order);
        historyList.replaceChildren();
        openModal("order-detail-modal");

        try {
            const data = await apiRequest(orderPath(order));
            fillDetail(data.order || data);
        } catch (err) {
            showError(detailMessage, err);
        }

        // Status history comes from the Delivery Status & Tracking service (S3).
        try {
            const data = await apiRequest("/api/deliveries/" + encodeURIComponent(order.id) + "/history");
            renderHistory(data.history || []);
        } catch (err) {
            showError(detailMessage, err);
        }
    }


    // ---------- edit (only before pickup) ----------

    function openEdit(order) {
        clearMessage(editMessage);

        editForm.orderId.value = order.id;
        FIELDS.forEach(function (field) {
            editForm[field].value = order[field] || "";
        });
        editForm.priority.value = order.priority || "standard";
        document.getElementById("edit-order-number").textContent = order.orderNumber;

        openModal("order-edit-modal");
    }

    editForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(editMessage);

        const changes = readOrderForm(editForm);
        const problem = validateOrder(changes);
        if (problem) return showMessage(editMessage, problem, "error");

        const button = editForm.querySelector("button[type='submit']");
        button.disabled = true;

        try {
            await apiRequest("/api/orders/" + encodeURIComponent(editForm.orderId.value), {
                method: "PATCH",
                body: changes
            });
            closeModal("order-edit-modal");
            showMessage(ordersMessage, "Order updated.", "success");
            loadOrders();
        } catch (err) {
            showError(editMessage, err);
        } finally {
            button.disabled = false;
        }
    });


    // ---------- cancel (soft delete) ----------

    async function cancelOrder(order) {
        if (!window.confirm("Cancel order " + order.orderNumber + "? This cannot be undone.")) return;

        clearMessage(ordersMessage);

        try {
            await apiRequest(orderPath(order) + "/cancel", { method: "PATCH" });
            showMessage(ordersMessage, "Order " + order.orderNumber + " cancelled.", "success");
            loadOrders();
        } catch (err) {
            showError(ordersMessage, err);
        }
    }


    loadCourierFilter();
    loadOrders();

})();