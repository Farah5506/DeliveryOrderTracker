const PAGE_ROLES = {
    "dispatcher": "dispatcher",
    "couriers": "dispatcher",
    "courier": "courier"
};


function saveSession(token, user) {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", JSON.stringify(user));
}

function getCurrentUser() {
    const user = sessionStorage.getItem("user");
    return user ? JSON.parse(user) : null;
}

function homePageFor(role) {
    return role === "courier" ? "courier.html" : "dispatcher.html";
}

function logout() {
    sessionStorage.clear();
    window.location.href = "login.html";
}

function currentPage() {
    const last = window.location.pathname.split("/").pop();
    return last.replace(".html", "") || "index";
}



function protectPage() {
    const requiredRole = PAGE_ROLES[currentPage()];
    if (!requiredRole) return;   // public page

    const user = getCurrentUser();

    if (!user || !sessionStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    if (user.role !== requiredRole) {
        window.location.href = homePageFor(user.role);
        return;
    }

    const nameElement = document.getElementById("user-name");
    if (nameElement) {
        nameElement.textContent = user.fullName || user.full_name || user.name || "";
    }

    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }
}



function setupLoginPage() {
    const form = document.getElementById("login-form");
    if (!form) return;

    const user = getCurrentUser();
    if (user && sessionStorage.getItem("token")) {
        window.location.href = homePageFor(user.role);
        return;
    }

    const message = document.getElementById("login-message");
    const button = form.querySelector("button[type='submit']");
    const widgetId = renderTurnstile("turnstile-widget");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearMessage(message);

        const email = form.email.value.trim();
        const password = form.password.value;

        if (!email || !password) {
            showMessage(message, "Please enter your email and password.", "error");
            return;
        }

        button.disabled = true;
        button.textContent = "Logging in...";

        try {
            const data = await apiRequest("/api/auth/login", {
                method: "POST",
                body: {
                    email: email,
                    password: password,
                    turnstileToken: getTurnstileToken(widgetId)
                }
            });

            saveSession(data.token, data.user);
            window.location.href = homePageFor(data.user.role);

        } catch (err) {
            showError(message, err);
            resetTurnstile(widgetId);
        } finally {
            button.disabled = false;
            button.textContent = "Login";
        }
    });
}


protectPage();
setupLoginPage();