// api-config.js
//
// One shared place for the Django backend's URL. Every other JS file
// that talks to the API (products.js, auth.js, cart-page.js, product.js,
// chatbot.js) uses this instead of each defining its own copy.
//
// IMPORTANT: this script tag must load FIRST, before any file that uses
// API_URL, on every page.
//
// Uses the current page's own origin (protocol + host), so this works
// unchanged whether running locally (http://127.0.0.1:8000) or on Render
// (https://shopzon-qy3x.onrender.com) -- no hardcoded port needed since
// Django serves both the API and the frontend files from the same origin.
const API_URL = window.location.origin + "/api";

