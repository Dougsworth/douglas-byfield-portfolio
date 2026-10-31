/* Sketchbook motion: pen written headline, tossable polaroid, pencil cursor with graphite,
   self drawing doodles, marker annotations, a peeling sticky note, a pencil drawn timeline
   and a terminal sticky note. Transform and opacity only, one rAF per effect, idle when still. */
(function () {
  var root = document.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceMQ.matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasG = !!(window.gsap && window.ScrollTrigger);
  var api = window.sketchbook = {};

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function len(el) { try { return el.getTotalLength(); } catch (e) { return 400; } }

  /* ---------- 1. the headline is written onto the page by a pen ---------- */
  api.writeHero = function (h1, tl, at) {
    if (!window.SplitText) return 0;
    var split;
    try { split = new SplitText(h1, { type: 'words,chars', charsClass: 'char' }); } catch (e) { return 0; }
    var chars = split.chars, n = chars.length;
    gsap.set(chars, { opacity: 0, y: 6, rotation: -6 });
    var pen = document.createElement('span');
    pen.className = 'write-pen';
    pen.setAttribute('aria-hidden', 'true');
    pen.innerHTML = '<svg viewBox="0 0 40 40"><path d="M3 37l3-10L29 4a3 3 0 0 1 4 0l3 3a3 3 0 0 1 0 4L13 34z"/><path d="M6 27l7 7M25 8l7 7"/><path class="lead" d="M3 37l4.5-1.5L4.5 32.5z"/></svg>';
    h1.appendChild(pen);
    var shown = 0, state = { v: 0 }, dur = Math.min(2.6, 0.024 * n + 0.5);
    function place(i, f) {
      var c = chars[Math.min(i, n - 1)], hb = h1.getBoundingClientRect(), cb = c.getBoundingClientRect();
      var x = cb.left - hb.left + cb.width * (i >= n ? 1 : f);
      var y = cb.top - hb.top + cb.height * 0.78 - 36;
      var wob = Math.sin(state.v * 1.9) * 3;
      gsap.set(pen, { x: x - 2, y: y + wob, rotation: Math.sin(state.v * 0.9) * 6 });
    }
    tl.set(pen, { opacity: 1 }, at);
    tl.to(state, {
      v: n, duration: dur, ease: 'none',
      onUpdate: function () {
        var i = Math.floor(state.v);
        while (shown < i && shown < n) {
          gsap.to(chars[shown], { opacity: 1, y: 0, rotation: 0, duration: 0.35, ease: 'back.out(2)' });
          shown++;
        }
        place(i, state.v - i);
      }
    }, at);
    tl.to(pen, { opacity: 0, x: '+=40', y: '-=30', rotation: 24, duration: 0.6, ease: 'power2.in',
      onComplete: function () { pen.remove(); gsap.set(chars, { clearProps: 'all' }); split.revert(); } }, at + dur + 0.1);
    return dur;
  };

  /* ---------- 2. polaroid: tilts toward the cursor, drag and toss it ---------- */
  function polaroid() {
    var wrap = $('.pol-wrap'); if (!wrap) return;
    var card = $('.polaroid', wrap), hero = $('.hero');
    var x = 0, y = 0, r = 0, vx = 0, vy = 0, vr = 0, raf = 0, dragging = false, last = null, moved = false;
    function apply() { wrap.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg)'; }
    function bounds() {
      var w = wrap.getBoundingClientRect(), h = hero.getBoundingClientRect();
      var ox = w.left - x, oy = w.top - y;           /* resting position on screen */
      return { minX: 8 - ox, maxX: innerWidth - 8 - w.width - ox,
               minY: h.top + 70 - oy, maxY: h.bottom + 60 - w.height - oy };
    }
    function step() {
      raf = 0; if (dragging) return;
      var b = bounds();
      vx *= 0.955; vy *= 0.955; vr *= 0.93;
      x += vx; y += vy; r += vr;
      if (x < b.minX) { x = b.minX; vx = -vx * 0.55; vr += vy * 0.08; }
      if (x > b.maxX) { x = b.maxX; vx = -vx * 0.55; vr -= vy * 0.08; }
      if (y < b.minY) { y = b.minY; vy = -vy * 0.55; vr -= vx * 0.08; }
      if (y > b.maxY) { y = b.maxY; vy = -vy * 0.55; vr += vx * 0.08; }
      r = Math.max(-40, Math.min(40, r));
      apply();
      if (Math.abs(vx) + Math.abs(vy) + Math.abs(vr) > 0.08) raf = requestAnimationFrame(step);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(step); }
    function home() {
      if (reduce || !hasG) { x = y = r = vx = vy = vr = 0; apply(); return; }
      var o = { x: x, y: y, r: r }; vx = vy = vr = 0;
      gsap.to(o, { x: 0, y: 0, r: 0, duration: 1, ease: 'elastic.out(1,0.6)', onUpdate: function () { x = o.x; y = o.y; r = o.r; apply(); } });
    }

    if (fine && !reduce) {
      wrap.classList.add('can-drag');
      wrap.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || e.button !== 0) return;
        if (hasG) gsap.killTweensOf(card);
        dragging = true; moved = false; wrap.classList.add('dragging');
        wrap.setPointerCapture(e.pointerId);
        last = { x: e.clientX, y: e.clientY, t: performance.now() };
        vx = vy = 0; e.preventDefault();
      });
      wrap.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var now = performance.now(), dt = Math.max(8, now - last.t);
        var dx = e.clientX - last.x, dy = e.clientY - last.y;
        x += dx; y += dy;
        vx = vx * 0.6 + (dx / dt * 16) * 0.4; vy = vy * 0.6 + (dy / dt * 16) * 0.4;
        r += (vx * 0.5 - r * 0.15) * 0.3;
        last = { x: e.clientX, y: e.clientY, t: now };
        if (Math.abs(x) + Math.abs(y) > 6) moved = true;
        apply();
      });
      function up() {
        if (!dragging) return;
        dragging = false; wrap.classList.remove('dragging');
        if (moved) { root.classList.add('tossed'); vr = vx * 0.35; kick(); }
      }
      wrap.addEventListener('pointerup', up);
      wrap.addEventListener('pointercancel', up);
      wrap.addEventListener('dblclick', home);

      /* tilt toward the cursor while resting */
      if (hasG) {
        var rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
        var ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        gsap.set(card, { transformPerspective: 900 });
        window.addEventListener('pointermove', function (e) {
          if (dragging || e.pointerType === 'touch') return;
          var b = card.getBoundingClientRect();
          if (b.bottom < 0 || b.top > innerHeight) return;
          var cx = (e.clientX - (b.left + b.width / 2)) / innerWidth, cy = (e.clientY - (b.top + b.height / 2)) / innerHeight;
          ry(Math.max(-14, Math.min(14, cx * 26))); rx(Math.max(-12, Math.min(12, -cy * 22)));
        }, { passive: true });
      }
    }
    /* keyboard: arrows toss it, Escape or Home puts it back */
    wrap.addEventListener('keydown', function (e) {
      var k = e.key, f = 14;
      if (k === 'Escape' || k === 'Home') { home(); e.preventDefault(); return; }
      if (k.indexOf('Arrow') !== 0) return;
      e.preventDefault(); root.classList.add('tossed');
      if (reduce) { x += k === 'ArrowLeft' ? -30 : k === 'ArrowRight' ? 30 : 0; y += k === 'ArrowUp' ? -30 : k === 'ArrowDown' ? 30 : 0; apply(); return; }
      if (k === 'ArrowLeft') vx -= f; if (k === 'ArrowRight') vx += f;
      if (k === 'ArrowUp') vy -= f; if (k === 'ArrowDown') vy += f;
      vr += (k === 'ArrowLeft' ? -3 : 3); kick();
    });
    window.addEventListener('resize', function () { x = y = r = 0; apply(); });
  }

  /* ---------- 3. pencil cursor with a graphite trail that fades ---------- */
  function pencil() {
    if (!fine || reduce) return;
    var cv = $('.graphite'), pen = $('.pencil'); if (!cv || !pen) return;
    var ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    var pts = [], raf = 0, LIFE = 900, px = -99, py = -99;
    function size() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    root.classList.add('pencil-on'); pen.classList.add('away');
    function draw() {
      raf = 0;
      var now = performance.now();
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        if (b.t - a.t > 80 || b.brk) continue;
        var life = 1 - (now - b.t) / LIFE;
        ctx.strokeStyle = 'rgba(58,52,50,' + (0.32 * life * life).toFixed(3) + ')';
        ctx.lineWidth = 1.1 + 0.9 * life;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      if (pts.length) raf = requestAnimationFrame(draw);
    }
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      px = e.clientX; py = e.clientY;
      pen.style.transform = 'translate3d(' + (px - 2) + 'px,' + (py - 28) + 'px,0)';
      pen.classList.remove('away');
      var t = e.target;
      var inter = t.closest && t.closest('a,button,input,label,.pol-wrap,.peel-flap');
      pen.classList.toggle('over', !!inter);
      if (t.closest && t.closest('input,.term')) return;
      pts.push({ x: px + (Math.random() - 0.5) * 0.6, y: py + (Math.random() - 0.5) * 0.6, t: performance.now() });
      if (pts.length > 160) pts.shift();
      if (!raf) raf = requestAnimationFrame(draw);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { pen.classList.add('away'); });
    window.addEventListener('scroll', function () { if (pts.length) pts[pts.length - 1].brk = true; pts.push({ x: px, y: py, t: performance.now(), brk: true }); }, { passive: true });
  }

  /* ---------- 4. margin doodles draw themselves as their section arrives ---------- */
  function doodles() {
    $$('.doodle').forEach(function (svg) {
      var parts = $$('path,circle', svg);
      if (reduce || !hasG) return;
      parts.forEach(function (p) { var L = len(p) + 2; gsap.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
      gsap.to(parts, { strokeDashoffset: 0, duration: 0.7, ease: 'power1.inOut', stagger: 0.3,
        delay: svg.closest('.hero') ? 2.6 : 0,
        scrollTrigger: { trigger: svg.closest('li') || svg, start: svg.closest('.hero') ? 'top bottom' : 'top 82%', once: true } });
    });
  }

  /* ---------- 5. statement: words ink in, phrases get circled and underlined, notes point at them ---------- */
  function statement() {
    var st = $('.statement'); if (!st) return;
    function markPath(m) {
      var w = m.offsetWidth, h = m.offsetHeight, svg = $('svg', m), p = $('path', svg), d;
      if (m.classList.contains('mk-circle')) {
        var W = w + 24, H = h + 14, cx = W / 2, cy = H / 2;
        d = 'M ' + (cx + W * .02) + ' ' + (H * .05) + ' C ' + (W * .84) + ' ' + (H * .02) + ', ' + (W * .995) + ' ' + (H * .24) + ', ' + (W * .99) + ' ' + (H * .52) +
            ' C ' + (W * .97) + ' ' + (H * .88) + ', ' + (W * .64) + ' ' + (H * .99) + ', ' + (W * .42) + ' ' + (H * .96) +
            ' C ' + (W * .1) + ' ' + (H * .93) + ', ' + (W * .005) + ' ' + (H * .7) + ', ' + (W * .02) + ' ' + (H * .45) +
            ' C ' + (W * .05) + ' ' + (H * .14) + ', ' + (W * .32) + ' ' + (H * .0) + ', ' + (W * .66) + ' ' + (H * .1);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      } else {
        var W2 = w + 8;
        d = 'M 4 10 C ' + (W2 * .3) + ' 6, ' + (W2 * .65) + ' 11, ' + (W2 - 4) + ' 7';
        svg.setAttribute('viewBox', '0 0 ' + W2 + ' 16');
      }
      p.setAttribute('d', d);
    }
    $$('.mk', st).forEach(function (m) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('aria-hidden', 'true');
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('pathLength', '1');
      svg.appendChild(p); m.appendChild(svg); markPath(m);
    });
    function remark() { $$('.mk', st).forEach(markPath); }
    window.addEventListener('resize', remark);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remark);
    var margin = $('.st-margin', st), anns = $$('.ann', st);
    function placeAnns() {
      if (!margin || getComputedStyle(margin).display === 'grid') { anns.forEach(function (a) { a.style.top = ''; }); return; }
      var mTop = margin.getBoundingClientRect().top, prevBottom = -999;
      anns.forEach(function (a) {
        var t = document.getElementById(a.getAttribute('data-for')); if (!t) return;
        var top = t.getBoundingClientRect().top - mTop - 30;
        top = Math.max(top, prevBottom + 14);
        a.style.top = top + 'px'; prevBottom = top + a.offsetHeight;
      });
    }
    placeAnns(); window.addEventListener('resize', placeAnns);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeAnns);

    var marks = $$('.mk path', st);
    if (reduce || !hasG) return;
    marks.forEach(function (p) { gsap.set(p, { strokeDasharray: 1.02, strokeDashoffset: 1.02 }); });
    /* words ink in as you read */
    var text = $('.st-text', st);
    if (window.SplitText) {
      try {
        var sw = new SplitText(text, { type: 'words' });
        gsap.fromTo(sw.words, { opacity: 0.16 }, { opacity: 1, stagger: 0.06, ease: 'none',
          scrollTrigger: { trigger: text, start: 'top 82%', end: 'bottom 62%', scrub: true } });
      } catch (e) {}
    }
    var mks = $$('.mk', st);
    mks.forEach(function (m, i) {
      var p = $('path', m), a = anns.filter(function (n) { return n.getAttribute('data-for') === m.id; })[0];
      var tl = gsap.timeline({ scrollTrigger: { trigger: m, start: 'top 62%', once: true } });
      tl.to(p, { strokeDashoffset: 0, duration: m.classList.contains('mk-circle') ? 0.8 : 0.55, ease: 'power2.inOut' });
      if (a) tl.fromTo(a, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }, '-=0.2');
    });
    anns.forEach(function (a) { if (!document.getElementById(a.getAttribute('data-for'))) gsap.set(a, { opacity: 1 }); });
  }

  /* ---------- 6. sticky note peels back to reveal a number ---------- */
  function peel() {
    var p = $('.peel'); if (!p) return;
    var btn = $('.peel-flap', p);
    function set(o) { p.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); btn.setAttribute('aria-label', o ? 'Put the sticky note back' : 'Lift the sticky note'); }
    btn.addEventListener('click', function () { set(!p.classList.contains('open')); });
    if (hasG && !reduce) {
      ScrollTrigger.create({ trigger: p, start: 'top 58%', once: true, onEnter: function () { setTimeout(function () { set(true); }, 250); } });
      var n = $('.peel-under b', p);
      ScrollTrigger.create({ trigger: p, start: 'top 58%', once: true, onEnter: function () {
        var o = { v: 0 }; gsap.to(o, { v: 3, duration: 1.2, delay: 0.5, ease: 'power2.out', onUpdate: function () { n.textContent = Math.round(o.v); } });
      } });
    }
  }

  /* ---------- 7. experience: a pencil line drawn with scroll, cards pinned as it reaches them ---------- */
  function timeline() {
    var track = $('.xp-track'); if (!track) return;
    var svg = $('.xp-line', track), path = $('path', svg), pen = $('.xp-pencil', track), cards = $$('.xp-card', track);
    var L = 0, stops = [], revealed = [];
    function build() {
      var W = track.offsetWidth, H = track.offsetHeight;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var narrow = W < 700, d, pts = [];
      if (narrow) {
        var lx = 12; d = 'M ' + lx + ' 0';
        cards.forEach(function (c, i) {
          var cy = c.offsetTop + 30;
          d += ' C ' + (lx + (i % 2 ? -6 : 8)) + ' ' + (cy - 60) + ', ' + (lx + (i % 2 ? 6 : -5)) + ' ' + (cy - 20) + ', ' + lx + ' ' + cy;
          pts.push(cy);
        });
        d += ' L ' + (lx + 2) + ' ' + (H - 10);
      } else {
        var first = cards[0], px = first.offsetLeft + first.offsetWidth / 2 - 120, py = -30;
        d = 'M ' + px + ' ' + py;
        cards.forEach(function (c) {
          var tx = c.offsetLeft + c.offsetWidth / 2, ty = c.offsetTop - 4, dy = ty - py;
          d += ' C ' + px + ' ' + (py + dy * 0.6) + ', ' + tx + ' ' + (ty - dy * 0.6) + ', ' + tx + ' ' + ty;
          px = tx; py = ty; pts.push(ty);
        });
        d += ' C ' + px + ' ' + (H - 40) + ', ' + (px + 60) + ' ' + (H - 10) + ', ' + (px + 160) + ' ' + (H - 20);
      }
      path.setAttribute('d', d);
      L = path.getTotalLength();
      /* how far along the line each pin sits */
      stops = cards.map(function (c, i) {
        var lo = 0, hi = L, target = pts[i];
        for (var k = 0; k < 22; k++) { var m = (lo + hi) / 2; if (path.getPointAtLength(m).y < target - 1) lo = m; else hi = m; }
        return hi / L;
      });
      path.style.strokeDasharray = L;
    }
    function reveal(i) {
      if (revealed[i]) return; revealed[i] = true;
      if (reduce || !hasG) { cards[i].style.opacity = 1; return; }
      gsap.fromTo(cards[i], { opacity: 0, y: -26, scale: 1.04, rotation: (i % 2 ? 6 : -6) },
        { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(1.7)', clearProps: 'transform' });
    }
    build();
    if (reduce || !hasG) { path.style.strokeDashoffset = 0; cards.forEach(function (c, i) { reveal(i); }); return; }
    path.style.strokeDashoffset = L;
    var st = ScrollTrigger.create({
      trigger: track, start: 'top 72%', end: 'bottom 70%', scrub: 0.4,
      onUpdate: function (self) {
        var pr = self.progress;
        path.style.strokeDashoffset = L * (1 - pr);
        var pt = path.getPointAtLength(L * pr);
        pen.style.opacity = pr > 0.002 && pr < 0.995 ? 1 : 0;
        pen.style.transform = 'translate3d(' + (pt.x - 4) + 'px,' + (pt.y - 30) + 'px,0) rotate(' + (Math.sin(pr * 40) * 5) + 'deg)';
        stops.forEach(function (s, i) { if (pr >= s - 0.02) reveal(i); });
      }
    });
    /* in case the page loads scrolled past */
    if (st.progress > 0) st.vars.onUpdate(st);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { build(); st.refresh(); st.vars.onUpdate(st); }, 150); });
  }

  /* ---------- 8. terminal sticky note ---------- */
  function terminal() {
    var form = $('.term-in'), out = $('#term-out'), input = $('#term-cmd'); if (!form) return;
    var hist = [], hi = 0;
    var mail = '<a href="mailto:douglasbyfield@yahoo.com">douglasbyfield@yahoo.com</a>';
    var C = {
      help: ['commands you can try:', '  whoami      who is this', '  experience  where I work', '  projects    things I shipped', '  events      the concept event sites', '  stack       what I build with', '  contact     how to reach me', '  hire        you know you want to', '  clear       wipe the note'],
      whoami: ['Douglas Byfield. Software engineer in Kingston, Jamaica.', 'I build AI, fintech, apps and websites, end to end.'],
      experience: ['now     AI Lab Engineer, AI Centre of Excellence', '        at one of the Caribbean’s largest financial groups', 'now     Software engineer, payments platform for global fintech', 'before  Microsoft Leap, GIS developer at a regional telecom', 'school  BSc, UWI. IEEE UWI Student Chair'],
      projects: ['<a href="https://ignitionsync.com" target="_blank" rel="noopener">ignitionsync.com</a>   car diagnostics for the Caribbean', '<a href="https://easycollectja.com" target="_blank" rel="noopener">easycollectja.com</a>  rent collection for landlords', '<a href="https://rebuild-ja.com" target="_blank" rel="noopener">rebuild-ja.com</a>     relief map after Hurricane Melissa'],
      events: ['<a href="https://bassline-bay.vercel.app" target="_blank" rel="noopener">bassline bay</a>   <a href="https://kingston-build-week.vercel.app" target="_blank" rel="noopener">kingston build week</a>   <a href="https://sorrel-and-smoke.vercel.app" target="_blank" rel="noopener">sorrel and smoke</a>'],
      stack: ['python, fastapi, azure, power platform, machine learning', 'typescript, react, next.js, supabase, vercel'],
      contact: ['email   ' + mail, 'github  <a href="https://github.com/Dougsworth" target="_blank" rel="noopener">Dougsworth</a>', 'insta   <a href="https://instagram.com/jamahlllll" target="_blank" rel="noopener">jamahlllll</a>'],
      hire: ['compiling offer letter...', 'done. now send it to ' + mail],
      ls: ['experience  projects  events  stack  contact'],
      sudo: ['nice try. ask nicely: type hire'],
      hello: ['hey! type help to see what I can do'],
      hi: ['hey! type help to see what I can do']
    };
    function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
    function print(lines, cmdText) {
      var block = document.createElement('div');
      block.innerHTML = '<p class="cmd">$ ' + esc(cmdText) + '</p>';
      out.appendChild(block);
      lines.forEach(function (l, i) {
        var p = document.createElement('p'); p.innerHTML = l;
        if (!reduce && hasG) { p.style.opacity = 0; gsap.to(p, { opacity: 1, duration: 0.2, delay: 0.05 + i * 0.07 }); }
        block.appendChild(p);
      });
      out.scrollTop = out.scrollHeight;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = input.value.trim(); input.value = '';
      if (!raw) return;
      hist.push(raw); hi = hist.length;
      var cmd = raw.toLowerCase().split(/\s+/)[0];
      if (cmd === 'clear') { out.innerHTML = ''; return; }
      if (cmd === 'sudo' && /hire/.test(raw.toLowerCase())) cmd = 'hire';
      print(C[cmd] || ['command not found: ' + esc(cmd), 'try help'], raw);
      if (cmd === 'contact' || cmd === 'hire') { /* nothing else, links are in the output */ }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && hist.length) { hi = Math.max(0, hi - 1); input.value = hist[hi]; e.preventDefault(); }
      if (e.key === 'ArrowDown' && hist.length) { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; e.preventDefault(); }
    });
  }

  function init() {
    if (hasG) gsap.registerPlugin(ScrollTrigger);
    [polaroid, pencil, doodles, statement, peel, timeline, terminal].forEach(function (f) { try { f(); } catch (e) { if (window.console) console.warn(e); } });
    /* reveal anything left hidden if motion is off */
    if (reduce || !hasG) $$('.ann,.xp-card').forEach(function (el) { el.style.opacity = 1; });
    if (hasG) setTimeout(function () { ScrollTrigger.refresh(); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
