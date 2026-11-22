
const IS_LOCAL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

const CONFIG = {
    API_BASE_URL: IS_LOCAL
        ? "http://localhost:3000"
        : "https://dot-api.vercel.app",   

 
    TURNSTILE_SITE_KEY: "1x00000000000000000000AA"
};