const slides = document.querySelectorAll('.slide');

function showSlide(id) {
    const next = document.getElementById(id);
    if (!next) return;
    slides.forEach(slide => {
        const active = slide === next;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    const focusTarget = next.querySelector('[autofocus], .world-card, .btn');
    focusTarget?.focus({ preventScroll: true });
}

function navigateTo(id, push = true) {
    showSlide(id);
    if (push) {
        try {
            history.pushState({ slide: id }, '', `#${id}`);
        } catch (_) {}
    } else {
        try {
            history.replaceState({ slide: id }, '', `#${id}`);
        } catch (_) {}
    }
}

// Normalize Start button text in case of encoding glitches
const startButton = document.getElementById('start-game');
if (startButton) {
    startButton.textContent = 'Start Game';
    startButton.addEventListener('click', () => navigateTo('world-slide'));
}

// Delegate clicks for any element with data-target to switch slides
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-target]');
    if (!target) return;
    const id = target.getAttribute('data-target');
    if (id) navigateTo(id);
});

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
    const id = e.state?.slide || (location.hash ? location.hash.slice(1) : 'intro-slide');
    showSlide(id);
});

// On load, respect hash or current active
window.addEventListener('DOMContentLoaded', () => {
    const initial = location.hash ? location.hash.slice(1) : (document.querySelector('.slide.is-active')?.id || 'intro-slide');
    navigateTo(initial, false);
});
