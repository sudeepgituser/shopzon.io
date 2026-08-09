// banner-slider.js
//
// Builds and runs the homepage banner slider — 5 wide promotional
// images that auto-advance, with arrow buttons and clickable dots.
// Lives outside #shopSection so it's never wiped out by script.js's
// product rendering.

const BANNER_IMAGES = [
  { src: 'banner1.jpg', alt: 'Fresh groceries and fruit' },
  { src: 'banner2.jpg', alt: 'Grocery basket essentials' },
  { src: 'banner3.jpg', alt: 'Great meals, one shopping trip' },
  { src: 'banner4.jpg', alt: 'Shop devices and tablets' },
  { src: 'banner5.jpg', alt: '25 years of Shopzon' },
];

function buildBannerSlider() {
  const outer = document.getElementById('bannerSliderOuter');
  if (!outer) {
    return;
  }

  const slidesHtml = BANNER_IMAGES.map(function (img) {
    return '<div class="banner-slide"><img src="' + img.src + '" alt="' + img.alt + '"></div>';
  }).join('');

  const dotsHtml = BANNER_IMAGES.map(function (_, index) {
    return '<span class="banner-dot' + (index === 0 ? ' active' : '') + '" data-index="' + index + '"></span>';
  }).join('');

  outer.innerHTML =
    '<div class="banner-slider" id="bannerSlider">' +
    '  <div class="banner-track" id="bannerTrack">' + slidesHtml + '</div>' +
    '  <button class="banner-arrow banner-prev" id="bannerPrev" aria-label="Previous slide">&#10094;</button>' +
    '  <button class="banner-arrow banner-next" id="bannerNext" aria-label="Next slide">&#10095;</button>' +
    '  <div class="banner-dots" id="bannerDots">' + dotsHtml + '</div>' +
    '</div>';

  initBannerSlider();
}

function initBannerSlider() {
  const track = document.getElementById('bannerTrack');
  const dots = document.querySelectorAll('.banner-dot');
  const prevBtn = document.getElementById('bannerPrev');
  const nextBtn = document.getElementById('bannerNext');
  const totalSlides = BANNER_IMAGES.length;
  let currentIndex = 0;
  let autoAdvanceTimer;

  function goToSlide(index) {
    currentIndex = (index + totalSlides) % totalSlides;
    track.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
    dots.forEach(function (dot, i) {
      dot.classList.toggle('active', i === currentIndex);
    });
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentIndex - 1);
  }

  function startAutoAdvance() {
    autoAdvanceTimer = setInterval(nextSlide, 4000);
  }

  function stopAutoAdvance() {
    clearInterval(autoAdvanceTimer);
  }

  nextBtn.addEventListener('click', function () {
    nextSlide();
    stopAutoAdvance();
    startAutoAdvance();
  });

  prevBtn.addEventListener('click', function () {
    prevSlide();
    stopAutoAdvance();
    startAutoAdvance();
  });

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      goToSlide(Number(dot.dataset.index));
      stopAutoAdvance();
      startAutoAdvance();
    });
  });

  const sliderEl = document.getElementById('bannerSlider');
  sliderEl.addEventListener('mouseenter', stopAutoAdvance);
  sliderEl.addEventListener('mouseleave', startAutoAdvance);

  startAutoAdvance();
}

// buildBannerSlider();