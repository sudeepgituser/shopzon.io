// products.js
//
// This USED to be a hardcoded array. Now it fetches real data from the
// Django backend instead. Every page that needs product data now has to
// wait for this fetch to finish before it can use PRODUCTS -- that's why
// we track a "ready" promise other scripts can wait on.

const API_BASE_URL = window.location.origin + "/api";

// Starts empty. Gets filled in once the fetch below completes.
let PRODUCTS = [];

// Other scripts (script.js, product.js, cart-page.js) await this promise
// before touching PRODUCTS, so they never run before the data arrives.
const productsReady = fetch(API_BASE_URL + "/products/")
  .then(function (response) {
    if (!response.ok) {
      throw new Error("Failed to load products: " + response.status);
    }
    return response.json();
  })
  .then(function (data) {
    // The API sends price/originalPrice/rating as strings (Django's
    // DecimalField does this), so we convert them to real numbers here
    // once, in one place, instead of every page having to remember to.
    PRODUCTS = data.map(function (product) {
      return {
        id: product.id,
        title: product.title,
        price: Number(product.price),
        originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
        rating: Number(product.rating),
        reviewCount: product.reviewCount,
        badge: product.badge,
        image: product.image,
        category: product.category,
        description: product.description,
        stockQuantity: product.stock_quantity
      };
    });
    return PRODUCTS;
  })
  .catch(function (error) {
    console.error("Could not load products from the backend:", error);
    return [];
  });

// Small helper used by product.html and cart.html to look up
// one product by its id. Returns undefined if not found.
function findProductById(id) {
  return PRODUCTS.find(function (product) {
    return String(product.id) === String(id);
  });
}