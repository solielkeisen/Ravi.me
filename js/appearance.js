/* Appearance panel: text size and light/dark, stored in localStorage.
   Progressive enhancement - without JS the page keeps whatever the pre-paint
   bootstrap in the document head applied, and the buttons do nothing. The
   theme and text size are site-wide; only the panel itself is desktop-only. */

(function () {
  'use strict';

  var panel = document.getElementById('appearance');
  if (!panel) return;

  var root = document.documentElement;

  /* Discrete steps, Wikipedia-style. Kept off the extremes so a large size
     still fits inside the fixed-width article column. */
  var STEPS = [0.875, 1, 1.125, 1.25, 1.375];
  var THEME_KEY = 'appearance-theme';
  var SIZE_KEY = 'appearance-size';

  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* storage disabled - the choice just won't survive a reload */
    }
  }

  /* --- Text size -------------------------------------------------------
     --font-scale is already applied by the bootstrap, so derive the current
     step from the computed value rather than keeping a second source of
     truth in storage. */

  function sizeIndex() {
    var scale = parseFloat(
      getComputedStyle(root).getPropertyValue('--font-scale')
    );
    if (!scale) return 1;

    var best = 0;
    for (var i = 1; i < STEPS.length; i++) {
      if (Math.abs(STEPS[i] - scale) < Math.abs(STEPS[best] - scale)) best = i;
    }
    return best;
  }

  var sizeButtons = Array.prototype.slice.call(
    panel.querySelectorAll('[data-size]')
  );

  function syncSizeButtons(index) {
    sizeButtons.forEach(function (btn) {
      var step = Number(btn.getAttribute('data-size'));
      // + is capped at the top step, - at the bottom.
      btn.disabled =
        (step > 0 && index === STEPS.length - 1) ||
        (step < 0 && index === 0);
    });
  }

  function setSize(index) {
    index = Math.max(0, Math.min(STEPS.length - 1, index));
    var scale = STEPS[index];

    root.style.setProperty('--font-scale', String(scale));
    write(SIZE_KEY, String(scale));
    syncSizeButtons(index);
  }

  sizeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setSize(sizeIndex() + Number(btn.getAttribute('data-size')));
    });
  });

  syncSizeButtons(sizeIndex());

  /* --- Theme ----------------------------------------------------------- */

  var themeButtons = Array.prototype.slice.call(
    panel.querySelectorAll('[data-theme-choice]')
  );

  function setTheme(theme) {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }

    themeButtons.forEach(function (btn) {
      btn.setAttribute(
        'aria-pressed',
        String(btn.getAttribute('data-theme-choice') === theme)
      );
    });

    write(THEME_KEY, theme);
  }

  themeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTheme(btn.getAttribute('data-theme-choice'));
    });
  });

  // Reflect whatever the bootstrap already applied, so the buttons agree
  // with the page on first paint.
  setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  /* Keyboard users can land on a disabled +/- button once they hit an end,
     so nudge focus to the button that still works. */
  panel.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;

    var focused = document.activeElement;
    if (!focused || !focused.disabled || !focused.hasAttribute('data-size')) {
      return;
    }

    var step = Number(focused.getAttribute('data-size'));
    var partner = sizeButtons.filter(function (btn) {
      return Number(btn.getAttribute('data-size')) === -step;
    })[0];

    if (partner && !partner.disabled) partner.focus();
  });
})();
