/* =============================================
   Shadow Net — Dashboard Script
   =============================================
   
   This file handles two responsibilities:
   1. Dark / Light mode toggle
   2. Dynamically populating the five summary cards
      with placeholder data

   ============================================= */


/* ─────────────────────────────────────────────
   1. PLACEHOLDER DATA
   ─────────────────────────────────────────────
   Change these numbers to update every card
   on the dashboard. In a real app, these would
   come from an API response (e.g. fetch()).
   ───────────────────────────────────────────── */

const dashboardData = {
    totalDevices: 120,    // All monitored devices
    critical: 3,    // Devices with critical vulnerabilities
    high: 8,    // Devices with high-risk issues
    medium: 24,    // Devices with medium-risk issues
    low: 85     // Devices with low or no risk
};


/* ─────────────────────────────────────────────
   2. POPULATE CARDS
   ─────────────────────────────────────────────
   This function grabs each card's <p> element
   by its ID and writes the number into it.
   It also sets the width of the mini progress
   bar relative to the total device count.
   ───────────────────────────────────────────── */

function populateCards(data) {
    /**
     * Helper — animated count-up effect.
     * Instead of just setting the number, we 
     * count from 0 to the target value over a 
     * short duration so it looks dynamic.
     *
     * @param {HTMLElement} element  — the DOM node to update
     * @param {number}      target   — the final number
     * @param {number}      duration — animation time in ms
     */
    function animateValue(element, target, duration = 1200) {
        // We use requestAnimationFrame for
        // a smooth 60fps counter animation.
        const start = performance.now();

        function update(currentTime) {
            // How far through the animation are we? (0 → 1)
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out curve makes the count slow down at the end
            const eased = 1 - Math.pow(1 - progress, 3);

            // Set the text to the current animated value
            element.textContent = Math.round(eased * target);

            // Keep going until we hit 100%
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // ── Map of card IDs → data keys ──
    const cardMap = [
        { id: 'val-total', key: 'totalDevices' },
        { id: 'val-critical', key: 'critical' },
        { id: 'val-high', key: 'high' },
        { id: 'val-medium', key: 'medium' },
        { id: 'val-low', key: 'low' }
    ];

    // Loop through each mapping and animate the value
    cardMap.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) {
            animateValue(el, data[key]);
        }
    });

    // ── Set progress bar widths ──
    // Each bar width = (cardValue / totalDevices) × 100%
    const total = data.totalDevices || 1;   // avoid division by zero

    const barMap = [
        { selector: '.card__bar-fill--total', value: total },
        { selector: '.card__bar-fill--critical', value: data.critical },
        { selector: '.card__bar-fill--high', value: data.high },
        { selector: '.card__bar-fill--medium', value: data.medium },
        { selector: '.card__bar-fill--low', value: data.low }
    ];

    barMap.forEach(({ selector, value }) => {
        const bar = document.querySelector(selector);
        if (bar) {
            // Delay slightly so the CSS transition is visible
            setTimeout(() => {
                bar.style.width = `${(value / total) * 100}%`;
            }, 300);
        }
    });
}


/* ─────────────────────────────────────────────
   3. DARK / LIGHT MODE TOGGLE
   ─────────────────────────────────────────────
   We listen for changes on the toggle checkbox.
   • Checked   → add    .light-mode on <body>
   • Unchecked → remove .light-mode on <body>

   We also save the preference in localStorage
   so it persists across page reloads.
   ───────────────────────────────────────────── */

function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Check if user previously selected a theme
    const savedTheme = localStorage.getItem('shadownet-theme');
    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        toggle.checked = true;          // Reflect in the checkbox
    }

    // Listen for toggle changes
    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            // Switch to light mode
            body.classList.add('light-mode');
            localStorage.setItem('shadownet-theme', 'light');
        } else {
            // Switch back to dark mode
            body.classList.remove('light-mode');
            localStorage.setItem('shadownet-theme', 'dark');
        }
    });
}


/* ─────────────────────────────────────────────
   4. INITIALISE LUCIDE ICONS
   ─────────────────────────────────────────────
   Lucide replaces <i data-lucide="icon-name">
   elements with inline SVGs. We call this after
   the DOM is ready.
   ───────────────────────────────────────────── */

function initIcons() {
    // Lucide exposes a global `lucide` object
    if (window.lucide) {
        lucide.createIcons();
    }
}


/* ─────────────────────────────────────────────
   5. DOM READY — BOOT EVERYTHING
   ─────────────────────────────────────────────
   Wait for the DOM to fully load, then:
   1. Render Lucide icons
   2. Set up the theme toggle
   3. Populate the summary cards
   ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
    initIcons();                       // Step 1
    initThemeToggle();                 // Step 2
    populateCards(dashboardData);      // Step 3
});
