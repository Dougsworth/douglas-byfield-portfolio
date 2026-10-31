/* Motion for the notebook design: smooth scroll, line reveals, drawn strokes, scrubbed reading */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function showAll() { root.classList.remove('js'); }
  if (reduce || !window.gsap || !window.ScrollTrigger) { showAll(); return; }
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  /* smooth scrolling */
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(function (a) {
      var id = a.getAttribute('href').replace(/^\//, '');
      if (a.getAttribute('href').charAt(0) === '/' && location.pathname !== '/') return;
      a.addEventListener('click', function (e) {
        var el = id === '#top' ? 0 : document.querySelector(id);
        if (el === null) return;
        e.preventDefault(); lenis.scrollTo(el, { offset: -110, duration: 1.3 });
      });
    });
  }

  document.addEventListener('kb:menu', function (e) { if (lenis) { e.detail ? lenis.stop() : lenis.start(); } });

  /* header tucks away on the way down, returns on the way up */
  var top = document.querySelector('.top'), lastY = 0;
  function onScroll(y) {
    if (!top) return;
    top.classList.toggle('is-scrolled', y > 20);
    var drawerOpen = document.getElementById('drawer') && document.getElementById('drawer').classList.contains('open');
    if (!drawerOpen) top.classList.toggle('is-hidden', y > lastY && y > 260);
    lastY = y;
  }
  if (lenis) lenis.on('scroll', function (e) { onScroll(e.scroll); });
  else window.addEventListener('scroll', function () { onScroll(scrollY); }, { passive: true });

  function splitLines(el) {
    if (!window.SplitText) return null;
    try { return new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' }); } catch (e) { return null; }
  }
  function drawStroke(svg, delay) {
    svg.querySelectorAll('path').forEach(function (p) {
      var len = p.getTotalLength ? p.getTotalLength() : 300;
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(p, { strokeDashoffset: 0, duration: 0.9, delay: delay || 0, ease: 'power2.inOut',
        scrollTrigger: { trigger: svg, start: 'top 92%', once: true } });
    });
  }

  function init() {
    /* hero: headline lines rise out of their masks, then copy, buttons and the photo */
    var hero = document.querySelector('.hero, .cs-hero');
    function playHero() {
    if (hero) {
      var heroRv = hero.querySelectorAll('.rv');
      gsap.set(heroRv, { opacity: 1, y: 0 });
      var h1 = hero.querySelector('h1');
      var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      tl.from('.top', { y: -40, opacity: 0, duration: 0.9 }, 0);
      var s = h1 && splitLines(h1);
      if (s) tl.from(s.lines, { yPercent: 115, duration: 1.15, stagger: 0.12, onComplete: function () { s.revert(); } }, 0.15);
      var lead = hero.querySelector('.lead, .eyebrow');
      if (lead) {
        var sl = splitLines(lead);
        tl.from(sl ? sl.lines : lead, { yPercent: sl ? 110 : 0, opacity: sl ? 1 : 0, duration: 1, stagger: 0.06, onComplete: function () { if (sl) sl.revert(); } }, 0.55);
      }
      var ctas = hero.querySelectorAll('.ctas .btn');
      if (ctas.length) tl.from(ctas, { y: 24, opacity: 0, duration: 0.8, stagger: 0.1 }, 0.85);
      var pol = hero.querySelector('.polaroid');
      if (pol) tl.fromTo(pol, { y: 70, rotation: -7, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 1.4, ease: 'expo.out' }, 0.1);
      var tag = hero.querySelector('.cs-tag');
      if (tag) tl.from(tag, { y: -40, rotation: 6, opacity: 0, duration: 1.2, ease: 'back.out(1.6)' }, 0.5);
      hero.querySelectorAll('.swipe').forEach(function (sv) { drawStroke(sv, 1.0); });
    }
    }

    /* opening screen: her name card, the scribble draws, then the panel lifts away */
    var intro = document.querySelector('.intro');
    var introOn = intro && getComputedStyle(intro).display !== 'none';
    if (introOn) {
      if (hero) gsap.set(hero.querySelectorAll('.rv'), { opacity: 0 });
      if (lenis) lenis.stop();
      var zig = intro.querySelector('.zig path'), zl = zig.getTotalLength();
      gsap.set(zig, { strokeDasharray: zl, strokeDashoffset: zl, opacity: 0 });
      gsap.timeline()
        .from('.intro-name', { yPercent: 40, opacity: 0, duration: 0.8, ease: 'power3.out' })
        .set(zig, { opacity: 1 }, '-=0.25').to(zig, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, '<')
        .to('.intro-in', { y: -30, opacity: 0, duration: 0.5, ease: 'power2.in' }, '+=0.35')
        .to(intro, { yPercent: -100, duration: 0.95, ease: 'power4.inOut' }, '-=0.15')
        .add(function () {
          intro.style.display = 'none';
          try { sessionStorage.setItem('kb-intro', '1'); } catch (e) {}
          if (lenis) lenis.start();
        })
        .add(playHero, '-=0.55');
    } else {
      playHero();
    }

    /* section headings reveal line by line */
    document.querySelectorAll('main h2, .proj h3, .screen h3').forEach(function (h) {
      if (hero && hero.contains(h)) return;
      var sp = splitLines(h); if (!sp) return;
      gsap.from(sp.lines, { yPercent: 115, duration: 1.05, stagger: 0.1, ease: 'power4.out',
        onComplete: function () { sp.revert(); },
        scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });

    /* highlighter strokes draw themselves in */
    document.querySelectorAll('main .swipe, .talk .swipe').forEach(function (sv) {
      if (hero && hero.contains(sv)) return;
      drawStroke(sv, 0.35);
    });

    /* everything else eases up as it arrives */
    var rvs = gsap.utils.toArray('.rv').filter(function (el) { return !el.closest('.hero, .cs-hero'); });
    ScrollTrigger.batch(rvs, {
      start: 'top 90%', once: true,
      onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12, overwrite: true }); }
    });

    /* sticky notes and proof items land with a little settle */
    gsap.utils.toArray('.notes .note-card, .steps li').forEach(function (n, i) {
      gsap.from(n, { y: 50, rotation: (i % 2 ? 6 : -6), duration: 1.1, ease: 'back.out(1.4)',
        scrollTrigger: { trigger: n, start: 'top 92%', once: true } });
    });
    gsap.utils.toArray('.proof li, .points li, .notes-list li').forEach(function (n) {
      gsap.from(n, { y: 26, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: n, start: 'top 94%', once: true } });
    });

    /* devices drift against the scroll */
    gsap.utils.toArray('.proj').forEach(function (card) {
      var p1 = card.querySelector('.p1, .b1'), p2 = card.querySelector('.p2, .b2');
      if (p1) gsap.fromTo(p1, { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
      if (p2) gsap.fromTo(p2, { yPercent: -4 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* case study copy reads in word by word as you scroll */
    if (window.SplitText) {
      document.querySelectorAll('.chap .body > p:not(.sub-h):not(.status):not(.fineprint)').forEach(function (p) {
        var sw; try { sw = new SplitText(p, { type: 'words' }); } catch (e) { return; }
        gsap.fromTo(sw.words, { opacity: 0.2 }, { opacity: 1, stagger: 0.05, ease: 'none',
          scrollTrigger: { trigger: p, start: 'top 85%', end: 'bottom 60%', scrub: true } });
      });
    }
    ScrollTrigger.refresh();
  }

  var started = false;
  function go() { if (started) return; started = true; try { init(); } catch (e) { showAll(); } }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
  setTimeout(go, 1800);
})();
