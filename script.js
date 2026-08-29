/* =========================================================
   SAME SKY · orbit engine
   ========================================================= */
(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Stars ---------- */
    const canvas = document.getElementById('stars');
    const ctx = canvas.getContext('2d');
    let stars = [], W = 0, H = 0, dpr = 1;
    const palette = ['42,35,64', '201,138,46', '193,70,126', '46,143,135', '110,79,198'];

    function seedStars() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.width = innerWidth * dpr;
        H = canvas.height = innerHeight * dpr;
        const count = Math.round((innerWidth * innerHeight) / 6500);
        stars = Array.from({ length: count }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            r: (Math.random() * 1.2 + 0.4) * dpr,
            a: Math.random() * 0.5 + 0.2,
            p: Math.random() * Math.PI * 2,
            s: Math.random() * 0.8 + 0.3,
            c: Math.random() < 0.82 ? palette[0] : palette[1 + Math.floor(Math.random() * 4)]
        }));
    }
    function drawStars(t) {
        ctx.clearRect(0, 0, W, H);
        for (const s of stars) {
            const tw = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(t * 0.001 * s.s + s.p);
            ctx.beginPath();
            ctx.fillStyle = `rgba(${s.c},${(s.a * tw).toFixed(3)})`;
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    seedStars();
    addEventListener('resize', seedStars);

    /* ---------- Orbit ---------- */
    const stage = document.getElementById('orbitStage');
    const section = document.getElementById('orbit');
    const plane = document.getElementById('plane');
    const planets = [...plane.querySelectorAll('.planet')];
    const captionName = document.getElementById('captionName');
    const captionLine = document.getElementById('captionLine');
    const captionBody = captionName.parentElement;
    const landBtn = document.getElementById('landBtn');

    const FRONT = 90;
    let rot = 0, target = 0, focus = 0;
    let dragging = false, dragX = 0, dragMoved = 0, dragRot = 0;
    let landed = false;

    function layout() {
        const R = plane.offsetWidth / 2;
        planets.forEach(p => {
            const a = (+p.dataset.angle) * Math.PI / 180;
            p.style.setProperty('--px', `${Math.cos(a) * R}px`);
            p.style.setProperty('--py', `${Math.sin(a) * R}px`);
        });
    }
    layout();
    addEventListener('resize', layout);

    const norm = d => ((d % 360) + 540) % 360 - 180;   // -180..180

    function targetFor(i) {
        const want = FRONT - +planets[i].dataset.angle;
        return rot + norm(want - rot);
    }
    function nearestPlanet(r) {
        let best = 0, bestD = 999;
        planets.forEach((p, i) => {
            const d = Math.abs(norm(+p.dataset.angle + r - FRONT));
            if (d < bestD) { bestD = d; best = i; }
        });
        return best;
    }
    function setFocus(i, announce = true) {
        if (i === focus && planets[i].classList.contains('is-focus')) return;
        focus = i;
        planets.forEach((p, k) => p.classList.toggle('is-focus', k === i));
        if (announce) {
            captionBody.classList.remove('swap');
            void captionBody.offsetWidth;
            captionBody.classList.add('swap');
        }
        captionName.textContent = planets[i].dataset.name.replace('&amp;', '&');
        captionLine.textContent = planets[i].dataset.line;
        document.body.style.setProperty('--tint', getComputedStyle(planets[i]).getPropertyValue('--mid'));
    }
    function goTo(i) { target = targetFor(i); setFocus(i); }
    function step(d) { goTo((focus + d + planets.length) % planets.length); }

    function applyRot() {
        plane.style.setProperty('--rot', `${rot}deg`);
        planets.forEach(p => {
            const s = Math.sin((+p.dataset.angle + rot) * Math.PI / 180); // 1 front, -1 back
            const k = (s + 1) / 2;
            p.style.setProperty('--depth', (0.45 + 0.55 * k).toFixed(3));
            p.style.setProperty('--sat', (0.6 + 0.4 * k).toFixed(3));
            p.style.zIndex = Math.round(10 + s * 10);
        });
    }

    function frame(t) {
        if (!dragging) {
            const diff = target - rot;
            if (Math.abs(diff) > 0.02) rot += diff * (reduceMotion ? 1 : 0.075);
            else rot = target;
        }
        applyRot();
        drawStars(t);
        requestAnimationFrame(frame);
    }
    setFocus(0, false);
    requestAnimationFrame(frame);

    /* drag */
    stage.addEventListener('pointerdown', e => {
        if (landed) return;
        dragging = true; dragMoved = 0; dragX = e.clientX; dragRot = rot;
        stage.classList.add('dragging');
        stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', e => {
        if (!dragging) return;
        const dx = e.clientX - dragX;
        dragMoved = Math.max(dragMoved, Math.abs(dx));
        rot = dragRot + dx * 0.35;
    });
    function endDrag() {
        if (!dragging) return;
        dragging = false;
        stage.classList.remove('dragging');
        const i = nearestPlanet(rot);
        target = targetFor(i);
        setFocus(i);
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    /* click planet */
    planets.forEach((p, i) => {
        p.querySelector('.sphere').addEventListener('click', () => {
            if (dragMoved > 6) return;
            if (i === focus && Math.abs(target - rot) < 1) land(i);
            else goTo(i);
        });
    });
    landBtn.addEventListener('click', () => land(focus));
    document.getElementById('prevPlanet').addEventListener('click', () => step(-1));
    document.getElementById('nextPlanet').addEventListener('click', () => step(1));

    addEventListener('keydown', e => {
        if (e.key === 'Escape') { if (moonOverlay.classList.contains('show')) closeMoon(); else if (landed) leave(); return; }
        if (landed || document.activeElement.closest?.('.study-overlay, .moon-overlay')) return;
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
    });

    /* ---------- Landing (planet surface) ---------- */
    const overlay = document.getElementById('studyOverlay');
    const studies = [...overlay.querySelectorAll('.study')];
    const studyConst = document.getElementById('studyConst');
    const ORDER = { headspace: 'Planet 1 / 3', roam: 'Planet 2 / 3', migraine: 'Planet 3 / 3' };
    let lastFocusEl = null;

    function land(i) {
        if (landed) return;
        landed = true;
        lastFocusEl = document.activeElement;
        const id = planets[i].dataset.planet;
        stage.classList.add('landing');
        section.classList.add('landing');
        document.body.classList.add('landed', 'locked');
        studies.forEach(s => s.classList.toggle('active', s.dataset.study === id));
        studyConst.textContent = ORDER[id] || '';
        const delay = reduceMotion ? 0 : 750;
        setTimeout(() => {
            overlay.hidden = false;
            overlay.scrollTop = 0;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                overlay.classList.add('show');
                document.getElementById('backBtn').focus({ preventScroll: true });
            }));
        }, delay);
    }
    function leave() {
        overlay.classList.remove('show');
        setTimeout(() => { overlay.hidden = true; }, reduceMotion ? 0 : 450);
        stage.classList.remove('landing');
        section.classList.remove('landing');
        document.body.classList.remove('landed', 'locked');
        landed = false;
        planets[focus].querySelector('.sphere').focus({ preventScroll: true });
    }
    document.getElementById('backBtn').addEventListener('click', leave);

    overlay.querySelectorAll('.next-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.goto;
            const i = planets.findIndex(p => p.dataset.planet === id);
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.hidden = true;
                stage.classList.remove('landing');
                section.classList.remove('landing');
                document.body.classList.remove('landed');
                landed = false;
                goTo(i);
                const wait = reduceMotion ? 0 : 1300;
                setTimeout(() => land(i), wait);
            }, reduceMotion ? 0 : 400);
        });
    });

    /* ---------- Moons ---------- */
    const moonOverlay = document.getElementById('moonOverlay');
    const moonStories = [...moonOverlay.querySelectorAll('.moon-story')];
    let moonReturn = null;

    function openMoon(id, from) {
        moonReturn = from;
        moonStories.forEach(m => m.classList.toggle('active', m.dataset.moon === id));
        moonOverlay.hidden = false;
        if (!landed) document.body.classList.add('locked');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            moonOverlay.classList.add('show');
            document.getElementById('moonClose').focus({ preventScroll: true });
        }));
    }
    function closeMoon() {
        moonOverlay.classList.remove('show');
        setTimeout(() => { moonOverlay.hidden = true; }, reduceMotion ? 0 : 350);
        if (!landed) document.body.classList.remove('locked');
        moonReturn?.focus?.({ preventScroll: true });
    }
    document.querySelectorAll('[data-moon]').forEach(el => {
        if (el.classList.contains('moon-story')) return;
        el.addEventListener('click', e => {
            e.stopPropagation();
            if (dragMoved > 6 && el.classList.contains('moon')) return;
            openMoon(el.dataset.moon, el);
        });
        if (el.classList.contains('moon')) el.addEventListener('pointerdown', e => e.stopPropagation());
    });
    document.getElementById('moonClose').addEventListener('click', closeMoon);
    moonOverlay.addEventListener('click', e => { if (e.target === moonOverlay) closeMoon(); });
})();
