/* Wikipedia-style contents panel: hamburger drawer + scrollspy.
   Progressive enhancement - the links are plain anchors and work with JS off,
   you just lose the drawer toggle and the active-section highlight. */

(function () {
  'use strict';

  var toc = document.getElementById('toc');
  var fab = document.getElementById('toc-fab');
  if (!toc || !fab) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll('.toc-list a'));
  if (!links.length) return;

  var scrim = document.getElementById('toc-scrim');
  var closeBtn = toc.querySelector('.toc-close');
  var lastFocused = null;

  /* --- Align under the post heading -------------------------------------
     The panel lives in the left margin, so line its top up with the bottom of
     the post header rather than guessing a fixed offset that breaks as soon as
     the title wraps to a second line. */

  function alignToHeading() {
    if (!window.matchMedia('(min-width: 1240px)').matches) {
      document.documentElement.style.removeProperty('--toc-top');
      return;
    }

    var header = document.querySelector('.post-header');
    if (!header) return;

    var gap = 20;
    var offset = Math.round(header.getBoundingClientRect().bottom + gap);

    // Don't push it past the fold on a short viewport.
    var maxOffset = Math.max(20, window.innerHeight - 120);
    document.documentElement.style.setProperty(
      '--toc-top',
      Math.min(offset, maxOffset) + 'px'
    );
  }

  alignToHeading();
  window.addEventListener('resize', alignToHeading);
  window.addEventListener('load', alignToHeading);

  // A late webfont swap changes the header height.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(alignToHeading);
  }

  /* --- Drawer --------------------------------------------------------- */

  function setOpen(open) {
    toc.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('has-toc-drawer', open);

    if (scrim) scrim.hidden = !open;

    if (open) {
      lastFocused = document.activeElement;
      if (closeBtn) closeBtn.focus();
    } else if (lastFocused && lastFocused.focus) {
      lastFocused.focus();
    }
  }

  function isOpen() {
    return toc.classList.contains('is-open');
  }

  fab.addEventListener('click', function () {
    setOpen(!isOpen());
  });

  if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
  if (scrim) scrim.addEventListener('click', function () { setOpen(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });

  // Following a link on mobile should dismiss the drawer.
  links.forEach(function (link) {
    link.addEventListener('click', function () {
      if (isOpen()) setOpen(false);
    });
  });

  // Growing past the breakpoint parks the panel back in the margin.
  window.matchMedia('(max-width: 1239px)').addEventListener('change', function (e) {
    if (!e.matches) setOpen(false);
    alignToHeading();
  });

  /* --- Scrollspy ------------------------------------------------------
     a.hash comes back percent-encoded for non-ASCII headings while the id
     attribute is raw, so match on the decoded id, never the raw hash string. */

  var entries = links
    .map(function (link) {
      return { link: link, id: decodeURIComponent(link.hash.slice(1)) };
    })
    .filter(function (entry) {
      return !!document.getElementById(entry.id);
    });

  var targets = entries.map(function (entry) {
    return document.getElementById(entry.id);
  });

  if (!targets.length) return;

  var active = null;

  function highlight(id) {
    if (id === active) return;
    active = id;
    entries.forEach(function (entry) {
      entry.link.classList.toggle('active', entry.id === id);
    });
  }

  function spy() {
    // The active section is the last heading scrolled above the threshold line.
    var offset = 100;
    var current = targets[0].id;

    for (var i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top - offset <= 0) {
        current = targets[i].id;
      } else {
        break;
      }
    }

    // Pin the last section once the page is scrolled to the bottom.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
      current = targets[targets.length - 1].id;
    }

    highlight(current);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      spy();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  spy();
})();
