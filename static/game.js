/* 창 열기, 탭, 설정(글자 크기, 텍스트 속도, BGM), 특성 슬롯 제한 */
(function () {
    function load(key, fallback) {
        try { var v = localStorage.getItem(key); return v === null ? fallback : v; }
        catch (e) { return fallback; }
    }
    function save(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* 저장을 못 해도 게임은 진행된다 */ }
    }

    // ---------- 창 ----------
    document.querySelectorAll('[data-open]').forEach(function (b) {
        b.addEventListener('click', function () { document.getElementById(b.dataset.open).classList.add('open'); });
    });
    document.querySelectorAll('.modal-close').forEach(function (b) {
        b.addEventListener('click', function () { b.closest('.modal-overlay').classList.remove('open'); });
    });
    document.querySelectorAll('.modal-overlay').forEach(function (m) {
        m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('open'); });
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(function (m) { m.classList.remove('open'); });
    });

    // ---------- 탭 ----------
    document.querySelectorAll('.tabs').forEach(function (tabs) {
        tabs.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var box = tabs.parentElement;
                box.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
                box.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
                btn.classList.add('active');
                box.querySelector('[data-panel="' + btn.dataset.tab + '"]').classList.add('active');
            });
        });
    });

    // ---------- 글자 크기 ----------
    var fontSelect = document.getElementById('set-font');
    function applyFont(v) { document.documentElement.dataset.font = v; }
    applyFont(load('wuxia-font', 'normal'));
    if (fontSelect) {
        fontSelect.value = load('wuxia-font', 'normal');
        fontSelect.addEventListener('change', function () { save('wuxia-font', fontSelect.value); applyFont(fontSelect.value); });
    }

    // ---------- 텍스트 속도 ----------
    var speedSelect = document.getElementById('set-speed');
    if (speedSelect) {
        speedSelect.value = load('wuxia-speed', '18');
        speedSelect.addEventListener('change', function () { save('wuxia-speed', speedSelect.value); });
    }

    function typeText() {
        var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-type]'));
        var delay = parseInt(load('wuxia-speed', '18'), 10);
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!nodes.length || !delay || reduced) return;

        // 같은 내용을 다시 그릴 때(물건 사용 등)는 다시 치지 않는다
        var signature = nodes.map(function (n) { return n.textContent; }).join('|');
        var seen = '';
        try { seen = sessionStorage.getItem('wuxia-shown') || ''; } catch (e) { /* 무시 */ }
        if (seen === signature) return;
        try { sessionStorage.setItem('wuxia-shown', signature); } catch (e) { /* 무시 */ }

        var full = nodes.map(function (n) { return n.textContent; });
        nodes.forEach(function (n) { n.textContent = ''; });
        var i = 0, c = 0, timer = null;

        function finish() {
            clearInterval(timer);
            nodes.forEach(function (n, k) { n.textContent = full[k]; });
            document.removeEventListener('click', finish, true);
            document.removeEventListener('keydown', finish, true);
        }
        document.addEventListener('click', finish, true);
        document.addEventListener('keydown', finish, true);

        timer = setInterval(function () {
            if (i >= nodes.length) { finish(); return; }
            c++;
            nodes[i].textContent = full[i].slice(0, c);
            if (c >= full[i].length) { i++; c = 0; }
        }, delay);
    }
    typeText();

    // ---------- BGM: 음원 파일 없이 즉석에서 연주하는 오음계 가락 ----------
    var volumeInput = document.getElementById('set-volume');
    var ctx = null, master = null, playing = false, noteTimer = null;
    var mood = document.body.dataset.mood || 'calm';
    var SCALES = {
        calm: [196, 220, 261.6, 293.7, 329.6, 392, 440, 523.3],
        battle: [146.8, 174.6, 196, 220, 261.6, 293.7],
        market: [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3]
    };
    var TEMPO = { calm: 1500, battle: 480, market: 900 };

    function pluck(freq, when, gainValue, length, type) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
        osc.connect(gain);
        gain.connect(master);
        osc.start(when);
        osc.stop(when + length + 0.05);
    }

    function nextNote() {
        var scale = SCALES[mood] || SCALES.calm;
        var now = ctx.currentTime + 0.02;
        var freq = scale[Math.floor(Math.random() * scale.length)];
        if (mood === 'battle') {
            pluck(70, now, 0.5, 0.25, 'sine');
            if (Math.random() < 0.6) pluck(freq, now, 0.16, 0.5, 'triangle');
        } else {
            pluck(freq, now, 0.3, 2.4, 'triangle');
            pluck(freq * 2, now, 0.05, 1.2, 'sine');
            if (Math.random() < 0.25) pluck(freq * 1.5, now + 0.28, 0.14, 1.8, 'triangle');
        }
        var wait = TEMPO[mood] * (0.75 + Math.random() * 0.6);
        noteTimer = setTimeout(nextNote, wait);
    }

    function setVolume(v) { if (master) master.gain.value = v / 100 * 0.7; }

    function startMusic() {
        var v = parseInt(load('wuxia-volume', '0'), 10);
        if (playing || !v) return;
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        ctx = ctx || new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        if (!master) { master = ctx.createGain(); master.connect(ctx.destination); }
        setVolume(v);
        playing = true;
        nextNote();
    }
    function stopMusic() { playing = false; clearTimeout(noteTimer); }

    if (volumeInput) {
        volumeInput.value = load('wuxia-volume', '0');
        volumeInput.addEventListener('input', function () {
            var v = parseInt(volumeInput.value, 10);
            save('wuxia-volume', String(v));
            if (v === 0) stopMusic(); else { startMusic(); setVolume(v); }
        });
    }
    // 브라우저 정책상 소리는 사용자의 첫 입력 뒤에만 시작할 수 있다
    document.addEventListener('pointerdown', startMusic, { once: true });
    document.addEventListener('keydown', startMusic, { once: true });

    // ---------- 특성 슬롯 제한 ----------
    var traitBoxes = document.querySelectorAll('input[name="trait"]');
    var slotNote = document.getElementById('slot-count');
    if (traitBoxes.length && slotNote) {
        var limit = parseInt(slotNote.dataset.limit, 10);
        var refresh = function () {
            var used = Array.prototype.filter.call(traitBoxes, function (b) { return b.checked; }).length;
            slotNote.textContent = used + ' / ' + limit;
            traitBoxes.forEach(function (b) { b.disabled = !b.checked && used >= limit; });
        };
        traitBoxes.forEach(function (b) { b.addEventListener('change', refresh); });
        refresh();
    }

    // ---------- 전투 기록은 항상 최신 줄이 보이게 ----------
    var battleLog = document.querySelector('.battle-log');
    if (battleLog) battleLog.scrollTop = battleLog.scrollHeight;
})();
