
(function () {

    const courierForm = document.getElementById("courier-form");
    const formMessage = document.getElementById("form-message");

    const filterForm = document.getElementById("courier-filter-form");
    const couriersBody = document.getElementById("couriers-list");
    const couriersLoading = document.getElementById("couriers-loading");
    const couriersEmpty = document.getElementById("couriers-empty");
    const courierCount = document.getElementById("courier-count");
    const listMessage = document.getElementById("list-message");

    const editForm = document.getElementById("courier-edit-form");
    const editMessage = document.getElementById("edit-message");

    const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const VEHICLES = { bike: "Bicycle", motorcycle: "Motorcycle", car: "Car", van: "Van" };


    function addCell(row, text) {
        const cell = document.createElement("td");
        cell.textContent = text;
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



    courierForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(formMessage);

        const courier = {
            fullName: courierForm.name.value.trim(),
            email: courierForm.email.value.trim().toLowerCase(),
            password: courierForm.password.value,
            phone: courierForm.phone.value.replace(/[\s-]/g, ""),
            vehicleType: courierForm.vehicle.value
        };

        if (courier.fullName.length < 2) return showMessage(formMessage, "Name must be at least 2 characters.", "error");
        if (!EMAIL_PATTERN.test(courier.email)) return showMessage(formMessage, "Please enter a valid email.", "error");
        if (courier.password.length < 8) return showMessage(formMessage, "Password must be at least 8 characters.", "error");
        if (!PHONE_PATTERN.test(courier.phone)) return showMessage(formMessage, "Please enter a valid phone number.", "error");
        if (!VEHICLES[courier.vehicleType]) return showMessage(formMessage, "Please choose a vehicle type.", "error");

        const button = courierForm.querySelector("button[type='submit']");
        button.disabled = true;

        try {
            await apiRequest("/api/couriers", { method: "POST", body: courier });
            showMessage(formMessage, "Courier " + courier.fullName + " added.", "success");
            courierForm.reset();
            loadCouriers();
        } catch (err) {
            showError(formMessage, err);
        } finally {
            button.disabled = false;
        }
    });



    async function loadCouriers() {
        clearMessage(listMessage);
        show(couriersLoading);

        const params = new URLSearchParams();
        new FormData(filterForm).forEach(function (value, key) {
            if (value) params.append(key, value);
        });
        const query = params.toString() ? "?" + params.toString() : "";

        try {
            const data = await apiRequest("/api/couriers" + query);
            renderCouriers(data.couriers || []);
        } catch (err) {
            showError(listMessage, err);
        } finally {
            hide(couriersLoading);
        }
    }

    function renderCouriers(couriers) {
        couriersBody.replaceChildren();
        courierCount.textContent = couriers.length;

        if (couriers.length === 0) {
            show(couriersEmpty);
            return;
        }
        hide(couriersEmpty);

        couriers.forEach(function (courier) {
            const row = document.createElement("tr");

            addCell(row, courier.fullName);
            addCell(row, courier.email);
            addCell(row, courier.phone);
            addCell(row, VEHICLES[courier.vehicleType] || courier.vehicleType);
            addBadgeCell(row,
                courier.availability === "available" ? "Available" : "Off duty",
                "badge-" + courier.availability);
            addCell(row, courier.activeOrders || 0);
            addBadgeCell(row,
                courier.isActive ? "Active" : "Deactivated",
                courier.isActive ? "badge-available" : "badge-inactive");

            const actions = addCell(row, "");
            actions.className = "actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", function () {
                openEdit(courier);
            });
            actions.appendChild(editButton);

            couriersBody.appendChild(row);
        });
    }

    filterForm.addEventListener("submit", function (event) {
        event.preventDefault();
        loadCouriers();
    });




    function openEdit(courier) {
        clearMessage(editMessage);

        editForm.id.value = courier.id;
        editForm.phone.value = courier.phone || "";
        editForm.vehicle.value = courier.vehicleType || "bike";
        editForm.availability.value = courier.availability || "available";
        editForm.isActive.value = courier.isActive ? "true" : "false";

        openModal("courier-edit-modal");
    }

    editForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(editMessage);

        const changes = {
            phone: editForm.phone.value.replace(/[\s-]/g, ""),
            vehicleType: editForm.vehicle.value,
            availability: editForm.availability.value,
            isActive: editForm.isActive.value === "true"
        };

        if (!PHONE_PATTERN.test(changes.phone)) {
            showMessage(editMessage, "Please enter a valid phone number.", "error");
            return;
        }

        try {
            await apiRequest("/api/couriers/" + editForm.id.value, { method: "PATCH", body: changes });
            closeModal("courier-edit-modal");
            showMessage(listMessage, "Courier updated.", "success");
            loadCouriers();
        } catch (err) {
            showError(editMessage, err);
        }
    });


    loadCouriers();

})();