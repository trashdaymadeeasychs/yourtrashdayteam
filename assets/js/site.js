/* ==========================================================================
   Your Trash Day Team — shared site scripts
   Powers the accessible mobile navigation, scroll reveal animations, and the
   FAQ accordion on the FAQ / Blog / Reviews pages. Progressive enhancement:
   every page works with this script disabled (see .no-js CSS fallbacks).
   ========================================================================== */
(function () {
  var prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('nav-menu');

  function closeMenu() {
    if (!toggle || !menu) return;
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    if (!toggle || !menu) return;
    menu.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';
      if (isOpen) { closeMenu(); } else { openMenu(); }
    });

    // Close after selecting a link on mobile.
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) { closeMenu(); }
    });

    // Escape closes the menu and returns focus to the toggle.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });

    // Reset state when resizing back up to the desktop layout.
    var desktopQuery = window.matchMedia('(min-width: 821px)');
    var handleResize = function (event) { if (event.matches) { closeMenu(); } };
    if (desktopQuery.addEventListener) {
      desktopQuery.addEventListener('change', handleResize);
    } else if (desktopQuery.addListener) {
      desktopQuery.addListener(handleResize);
    }
  }

  /* ---------- Scroll reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- FAQ accordion ---------- */
  var questions = document.querySelectorAll('.faq-q');
  questions.forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;

    // Keep max-height numeric at all times. Animating to/from the keyword
    // `none` is not interpolatable and leaves panels stuck open in some
    // engines, so we always use a measured pixel height. Content here is
    // static text, so a pinned pixel height shows the full answer.
    function setOpen(open) {
      btn.setAttribute('aria-expanded', String(open));
      if (open) {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      } else {
        // Ensure a resolved starting height, then collapse to 0.
        panel.style.maxHeight = panel.scrollHeight + 'px';
        void panel.offsetHeight;
        panel.style.maxHeight = '0px';
      }
    }

    // Start collapsed (JS present); markup ships expanded for no-JS/SEO.
    btn.setAttribute('aria-expanded', 'false');
    panel.style.maxHeight = '0px';

    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      setOpen(!open);
    });
  });

  // Re-measure open panels after viewport resizes so wrapped text still fits.
  window.addEventListener('resize', function () {
    document.querySelectorAll('.faq-q[aria-expanded="true"]').forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      panel.style.maxHeight = 'none';
      var h = panel.scrollHeight;
      panel.style.maxHeight = h + 'px';
    });
  });
})();
