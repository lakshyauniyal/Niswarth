// ==== FLOATING DIYAS (Subtle) ====
const diyaContainer = document.querySelector('.diya-container');
function createDiya() {
  const diya = document.createElement('div');
  diya.className = 'diya';
  diya.style.left = Math.random() * 100 + '%';
  diya.style.animationDuration = (Math.random() * 4 + 6) + 's';
  diyaContainer.appendChild(diya);
  setTimeout(() => diya.remove(), 10000);
}
setInterval(createDiya, 600);

// ==== HOVER BACKGROUND IMAGES ====
document.querySelectorAll('.card').forEach(card => {
  const imgUrl = card.getAttribute('data-hover-img');
  if (imgUrl) {
    // Preload image
    const img = new Image();
    img.onload = () => {
      card.style.setProperty('--hover-bg', `url(${imgUrl})`);
    };
    img.src = imgUrl;

    // Apply via CSS custom property
    card.style.setProperty('--hover-bg', `url(${imgUrl})`);
  }
});

// ==== COUNTERS ====
const counters = document.querySelectorAll('.counter-num');
const speed = 200;
const animateCounter = (el) => {
  const target = +el.getAttribute('data-target');
  const count = +el.innerText;
  const inc = target / speed;
  if (count < target) {
    el.innerText = Math.ceil(count + inc);
    setTimeout(() => animateCounter(el), 15);
  } else {
    el.innerText = target >= 1000000 ? '₹' + (target/10000000).toFixed(1) + ' Cr' : target.toLocaleString();
  }
};
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      counters.forEach(c => animateCounter(c));
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
counterObserver.observe(document.querySelector('.counters'));

// ==== CAROUSEL ====
const slides = document.getElementById('slides');
let index = 0;
const slideCount = slides.children.length;
setInterval(() => {
  index = (index + 1) % slideCount;
  slides.style.transform = `translateX(-${index * 100}%)`;
}, 4000);

// ==== SCROLL REVEAL ====
const animItems = document.querySelectorAll('.animate');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = 1;
      entry.target.style.animationPlayState = 'running';
    }
  });
}, { threshold: 0.15 });
animItems.forEach(item => {
  item.style.opacity = 0;
  revealObserver.observe(item);
});