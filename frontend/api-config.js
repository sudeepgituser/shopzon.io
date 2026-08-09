// api-config.js
//
// One shared place for the Django backend's URL. Every other JS file
// that talks to the API (products.js, auth.js, cart-page.js, product.js,
// chatbot.js) uses this instead of each defining its own copy.
//
// IMPORTANT: this script tag must load FIRST, before any file that uses
// API_URL, on every page.

const API_URL = "http://" + window.location.hostname + ":8000/api";