const FLOCI_API = "http://PASTE-API-ID.execute-api.localhost.floci.io:4566";

const ON_FLOCI = window.location.port === "4566";

const IS_LOCAL =
    !ON_FLOCI &&
    (window.location.hostname === "localhost" ||
     window.location.hostname === "127.0.0.1");

const CONFIG = {
    API_BASE_URL: IS_LOCAL ? "http://localhost:3000" : FLOCI_API,

    // Cloudflare's public TEST site key: always passes. Use it on localhost and Floci.
    TURNSTILE_SITE_KEY: "1x00000000000000000000AA"
};