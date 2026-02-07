/* ============================================
   KWIACIARNIA RÓŻA - MAIN JS
   ============================================ */

// ==========================================
// KREDYTY DEWELOPERSKIE (Widoczne w konsoli F12)
// ==========================================
const brand = "JakubL";
const github = "https://github.com/JakubLeb";

console.log(
    `%c🚀 Strona wykonana przez ${brand}`,
    `
  background: linear-gradient(90deg, #111, #1f1f1f);
  color: #bada55;
  font-size: 16px;
  padding: 10px 14px;
  border-radius: 6px;
  font-weight: bold;
  letter-spacing: 0.5px;
  `
);

console.log(
    `%c💻 GitHub: ${github}`,
    `
  background: #24292e;
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid #444;
  font-family: monospace;
  font-size: 13px;
  `
);


/**
 * Mobile menu toggle
 */
function initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (!menuBtn || !navLinks) return;

    menuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');

        // Animacja hamburger menu
        menuBtn.classList.toggle('active');
    });

    // Zamknij menu po kliknięciu w link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuBtn.classList.remove('active');
        });
    });
}

/**
 * Smooth scroll dla linków nawigacyjnych
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');

            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                e.preventDefault();

                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Lazy loading dla obrazków w galerii
 */
function initLazyLoading() {
    const images = document.querySelectorAll('.gallery-item img');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;

                    // Jeśli obrazek ma data-src, użyj go
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }

                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px'
        });

        images.forEach(img => imageObserver.observe(img));
    }
}

/**
 * Lightbox Gallery - powiększanie zdjęć
 */
function initLightbox() {
    const galleryItems = document.querySelectorAll('.gallery-item');

    if (galleryItems.length === 0) return;

    // Tworzenie struktury lightbox
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-overlay';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <button class="lightbox-close" aria-label="Zamknij">✕</button>
            <button class="lightbox-nav prev" aria-label="Poprzednie zdjęcie">‹</button>
            <img class="lightbox-image" src="" alt="Powiększone zdjęcie">
            <button class="lightbox-nav next" aria-label="Następne zdjęcie">›</button>
            <div class="lightbox-counter"></div>
        </div>
    `;
    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector('.lightbox-image');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    const lightboxPrev = lightbox.querySelector('.lightbox-nav.prev');
    const lightboxNext = lightbox.querySelector('.lightbox-nav.next');
    const lightboxCounter = lightbox.querySelector('.lightbox-counter');
    const lightboxContent = lightbox.querySelector('.lightbox-content');

    let currentIndex = 0;
    const images = Array.from(galleryItems).map(item => {
        const img = item.querySelector('img');
        return {
            src: img.src.replace('w=400&h=400', 'w=1200&h=1200'), // Większa wersja
            alt: img.alt
        };
    });

    /**
     * Otwiera lightbox z określonym zdjęciem
     */
    function openLightbox(index) {
        currentIndex = index;
        updateLightboxImage();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Zamyka lightbox
     */
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Aktualizuje zdjęcie w lightbox
     */
    function updateLightboxImage() {
        const image = images[currentIndex];
        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        lightboxCounter.textContent = `${currentIndex + 1} / ${images.length}`;

        // Ukryj/pokaż strzałki nawigacji
        lightboxPrev.style.display = images.length > 1 ? 'block' : 'none';
        lightboxNext.style.display = images.length > 1 ? 'block' : 'none';
    }

    /**
     * Przejście do następnego zdjęcia
     */
    function nextImage() {
        currentIndex = (currentIndex + 1) % images.length;
        updateLightboxImage();
    }

    /**
     * Przejście do poprzedniego zdjęcia
     */
    function prevImage() {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        updateLightboxImage();
    }

    // Event listeners dla elementów galerii
    galleryItems.forEach((item, index) => {
        item.addEventListener('click', () => openLightbox(index));
    });

    // Event listeners dla lightbox
    lightboxClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
    });

    lightboxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        prevImage();
    });

    lightboxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        nextImage();
    });

    // Zamknięcie po kliknięciu w tło
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Zapobiegaj zamknięciu przy kliknięciu w content
    lightboxContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Obsługa klawiatury
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                prevImage();
                break;
            case 'ArrowRight':
                nextImage();
                break;
        }
    });

    // Obsługa swipe na urządzeniach dotykowych
    let touchStartX = 0;
    let touchEndX = 0;

    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextImage();
            } else {
                prevImage();
            }
        }
    }
}

/**
 * Inicjalizacja wszystkich funkcji
 */
function init() {
    initMobileMenu();
    initSmoothScroll();
    initLazyLoading();
    initLightbox();
}

// Uruchom po załadowaniu DOM
document.addEventListener('DOMContentLoaded', init);