// script.js
//
// Page-specific behavior for index.html. The big change from before:
// the 8 product boxes used to be written directly in index.html. Now
// they're built here in JavaScript, using whatever products.js fetched
// from the Django backend. That means adding a product in the admin
// panel now shows up on the site automatically, with no HTML editing.

const cartBtn = document.getElementById('cartBtn');
const shopSectionTop = document.getElementById('shopSectionTop');
const shopSectionBottom = document.getElementById('shopSectionBottom');

const BADGE_LABELS = {
  'best-seller': 'Best Seller',
  'amazons-choice': "Amazon's Choice",
  'limited-deal': 'Limited Deal'
};

// Builds the star icons for one product's rating, e.g. 4.5 -> 4 full
// stars, 1 half star, 0 empty stars.
function buildStarsHtml(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  let html = '';
  for (let i = 0; i < fullStars; i++) {
    html += '<i class="fa-solid fa-star"></i>';
  }
  if (hasHalfStar) {
    html += '<i class="fa-solid fa-star-half-stroke"></i>';
  }
  for (let i = 0; i < emptyStars; i++) {
    html += '<i class="fa-regular fa-star"></i>';
  }
  return html;
}

function buildBadgeHtml(badge) {
  if (!badge) {
    return '';
  }
  return '<span class="badge ' + badge + '">' + BADGE_LABELS[badge] + '</span>';
}

function buildPriceRowHtml(product) {
  let html = '<span class="price">\u20B9' + product.price.toLocaleString('en-IN') + '</span>';

  if (product.originalPrice) {
    const discountPercent = Math.round((1 - product.price / product.originalPrice) * 100);
    html += '<span class="price-original">\u20B9' + product.originalPrice.toLocaleString('en-IN') + '</span>';
    html += '<span class="discount-badge">-' + discountPercent + '%</span>';
  }

  return html;
}

// Turns one product object into the HTML for one .box card.
function buildProductBoxHtml(product) {
  const outOfStock = Number(product.stockQuantity) <= 0;

  return (
    '<div class="box" data-id="' + product.id + '" data-category="' + product.category +
    '" data-title="' + product.title + '" data-price="' + product.price + '">' +
      buildBadgeHtml(product.badge) +
      (outOfStock ? '<span class="out-of-stock-overlay-badge">Out of Stock</span>' : '') +
      '<div class="box-content' + (outOfStock ? ' box-content-out-of-stock' : '') + '">' +
        '<h2>' + product.title + '</h2>' +
        '<div class="box-img-wrap">' +
          '<div class="box-img" style="background-image: url(\'' + product.image + '\');"></div>' +
        '</div>' +
        '<div class="rating">' +
          buildStarsHtml(product.rating) +
          '<span class="rating-count">(' + product.reviewCount.toLocaleString('en-IN') + ')</span>' +
        '</div>' +
        '<div class="price-row">' + buildPriceRowHtml(product) + '</div>' +
        '<a class="view-details" href="product.html?id=' + product.id + '">View details</a>' +
        (outOfStock
          ? '<p class="add-to-cart add-to-cart-disabled">Out of Stock</p>'
          : '<p class="add-to-cart">Add to cart</p>') +
      '</div>' +
    '</div>'
  );
}

function renderProducts(products) {
  const midpoint = Math.ceil(products.length / 2);
  const firstHalf = products.slice(0, midpoint);
  const secondHalf = products.slice(midpoint);

  shopSectionTop.innerHTML = firstHalf.map(buildProductBoxHtml).join('');
  shopSectionBottom.innerHTML = secondHalf.map(buildProductBoxHtml).join('');

  attachAddToCartHandlers();

  if (typeof buildBannerSlider === 'function') {
    buildBannerSlider();
  }
}

function attachAddToCartHandlers() {
  document.querySelectorAll('.add-to-cart:not(.add-to-cart-disabled)').forEach(function (button) {
    button.addEventListener('click', function (event) {
      const box = event.target.closest('.box');
      if (!box) {
        return;
      }
      const productId = Number(box.dataset.id);
      addToCart(productId, 1);
      flashCart();
    });
  });
}

function flashCart() {
  cartBtn.style.transform = 'scale(1.15)';
  setTimeout(function () {
    cartBtn.style.transform = 'scale(1)';
  }, 150);
}

// Wait for products.js's fetch to finish, then draw the page.
productsReady.then(renderProducts);

// ---------- SEARCH + CATEGORY FILTER ----------
const searchInput = document.getElementById('searchInput');
const categorySelect = document.getElementById('categorySelect');
const searchBtn = document.getElementById('searchBtn');
const noResults = document.getElementById('noResults');

function filterProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  // Query fresh every time, since boxes are rebuilt by renderProducts()
  // and old references would go stale.
  const boxes = document.querySelectorAll('.box');
  let visibleCount = 0;

  boxes.forEach(function (box) {
    const title = box.dataset.title.toLowerCase();
    const boxCategory = box.dataset.category;

    const matchesQuery = query === '' || title.includes(query);
    const matchesCategory = category === 'all' || category === boxCategory;

    if (matchesQuery && matchesCategory) {
      box.classList.remove('hidden');
      visibleCount++;
    } else {
      box.classList.add('hidden');
    }
  });

  noResults.style.display = visibleCount === 0 ? 'block' : 'none';
}

searchBtn.addEventListener('click', filterProducts);
categorySelect.addEventListener('change', filterProducts);
searchInput.addEventListener('keyup', filterProducts);

// ---------- LANGUAGE SELECT ----------
function changeLanguage() {
  const lang = document.getElementById('language-three').value;
  const labels = {
    en: 'Language switched to English',
    hi: 'भाषा हिंदी में बदल गई',
    es: 'Idioma cambiado a Español',
    fr: 'Langue changée en Français',
    de: 'Sprache auf Deutsch geändert'
  };
  console.log(labels[lang]);
}

// ---------- SLIDE-OUT MENU ----------
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const menuToggle = document.getElementById('menuToggle');
const closeMenu = document.getElementById('closeMenu');

function openMenu() {
  sideMenu.classList.add('open');
  overlay.classList.add('show');
}

function closeMenuFn() {
  sideMenu.classList.remove('open');
  overlay.classList.remove('show');
}

menuToggle.addEventListener('click', openMenu);
closeMenu.addEventListener('click', closeMenuFn);
overlay.addEventListener('click', closeMenuFn);

// ---------- BACK TO TOP ----------
document.getElementById('backToTop').addEventListener('click', function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});