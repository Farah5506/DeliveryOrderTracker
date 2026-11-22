(function () {

    const trackForm = document.getElementById("track-form");
    const orderInput = document.getElementById("order-number");
    const trackMessage = document.getElementById("track-message");
    const loading = document.getElementById("tracking-loading");
    const result = document.getElementById("tracking-result");
    const timeline = document.getElementById("status-timeline");

    const ORDER_PATTERN = /^DOT-[A-Z0-9]{6}$/;

    const widgetId = renderTurnstile("turnstile-widget");


    trackForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(trackMessage);
        hide(result);

        const orderNumber = orderInput.value.trim().toUpperCase();

        if (!ORDER_PATTERN.test(orderNumber)) {
            showMessage(trackMessage, "Order number should look like DOT-7K3P9Q.", "error");
            return;
        }

        const token = getTurnstileToken(widgetId);
        if (!token) {
            showMessage(trackMessage, "Please complete the bot check first.", "error");
            return;
        }

        show(loading);

        try {
            const data = await apiRequest(
                "/api/track/" + encodeURIComponent(orderNumber) +
                "?turnstileToken=" + encodeURIComponent(token)
            );
            showResult(data.order || data);

        } catch (err) {
            if (err.status === 404) {
                showMessage(trackMessage, "No order found with that number.", "error");
            } else {
                showError(trackMessage, err);
            }
        } finally {
            hide(loading);
            resetTurnstile(widgetId);   
        }
    });


    function showResult(order) {
        document.getElementById("result-order-number").textContent = order.orderNumber;
        setStatusBadge(document.getElementById("result-status"), order.status);
        document.getElementById("result-updated").textContent =
            "Last updated: " + formatDate(order.updatedAt);

        timeline.replaceChildren();

        (order.history || []).forEach(function (entry) {
            const item = document.createElement("li");

            const title = document.createElement("strong");
            title.textContent = formatStatus(entry.toStatus || entry.status);
            item.appendChild(title);

            const time = document.createElement("span");
            time.className = "time";
            time.textContent = formatDate(entry.createdAt);
            item.appendChild(time);

            timeline.appendChild(item);
        });

        show(result);
    }

})();