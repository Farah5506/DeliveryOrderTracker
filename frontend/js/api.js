
class ApiError extends Error {
    constructor(code, message, status, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details || null;
    }
}



async function apiRequest(path, options = {}) {

    const headers = {};
    const token = sessionStorage.getItem("token");

    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }

    let body = undefined;
    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
    }

    let response;
    try {
        response = await fetch(CONFIG.API_BASE_URL + path, {
            method: options.method || "GET",
            headers: headers,
            body: body
        });
    } catch (err) {
        throw new ApiError("NETWORK_ERROR", "Could not reach the server. Please try again.", 0);
    }

    let data = null;
    const text = await response.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (err) {
            data = null;
        }
    }

    if (!response.ok) {
        const error = data && data.error ? data.error : {};

        if (response.status === 401 && token) {
            sessionStorage.clear();
            window.location.href = "login.html";
        }

        throw new ApiError(
            error.code || "HTTP_" + response.status,
            error.message || "Request failed (" + response.status + ")",
            response.status,
            error.details
        );
    }

    return data;
}


function showMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = type || "";
}

function clearMessage(element) {
    if (!element) return;
    element.textContent = "";
    element.className = "";
}

function showError(element, err) {
    showMessage(element, err.message || "Something went wrong.", "error");
}



function show(element) {
    if (element) element.classList.remove("hidden");
}

function hide(element) {
    if (element) element.classList.add("hidden");
}



function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("open");
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("open");
}

document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-close]");
    if (button) {
        closeModal(button.dataset.close);
    }
});




const STATUS_LABELS = {
    created: "Created",
    assigned: "Assigned",
    picked_up: "Picked up",
    on_the_way: "On the way",
    delivered: "Delivered",
    failed: "Failed",
    cancelled: "Cancelled"
};

function formatStatus(status) {
    return STATUS_LABELS[status] || status;
}

function setStatusBadge(element, status) {
    if (!element) return;
    element.textContent = formatStatus(status);
    element.className = "badge status-" + status;
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return date.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function mapLink(lat, lon) {
    return "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lon;
}



function renderTurnstile(containerId) {
    if (!window.turnstile || !document.getElementById(containerId)) {
        return null;
    }
    return turnstile.render("#" + containerId, {
        sitekey: CONFIG.TURNSTILE_SITE_KEY
    });
}

function getTurnstileToken(widgetId) {
    if (!window.turnstile || widgetId === null) return "";
    return turnstile.getResponse(widgetId) || "";
}

function resetTurnstile(widgetId) {
    if (window.turnstile && widgetId !== null) {
        turnstile.reset(widgetId);
    }
}