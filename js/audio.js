// 소리 — Web Audio 실시간 합성(파일 없음). 효과음 + 칩튠 배경음(로비 · 전투 · 보스).
// 나중에 파일 소리로 바꾸려면 같은 함수 이름으로 갈아끼우면 된다.
(function (root) {
  const BGM_VOL = 0.4;   // [v4.8] 배경음 크기(전 0.45). 곡별 크기는 파일에서 맞춤(tools/audio_master.py)
  class Audio {
    constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.vol = 0.55; this.last = {}; this.bgm = null; }
    init() {
      // 첫 손가락 입력 때: 막혀 있던 배경음 재생 다시 시도(자동 재생 정책)
      if (this.tracks && this.bgmKind && this.tracks[this.bgmKind] && this.tracks[this.bgmKind].paused) { const a = this.tracks[this.bgmKind]; const p = a.play(); if (p && p.catch) p.catch(() => {}); this.fade(a, this.musicOn && this.on ? BGM_VOL : 0); }
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8;
        // [v4.8] 효과음 묶음: 고음 줄임 → 압축기(후반에 발사음이 초당 25번 겹쳐도 전체가 커지지 않게 · 측정 test/qa_sfxcount.js)
        const shelf = this.ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 3200; shelf.gain.value = -5;
        const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.knee.value = 18; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.16;
        this.sfxBus.connect(shelf); shelf.connect(comp); comp.connect(this.master);
        this.musBus = this.ctx.createGain(); this.musBus.gain.value = 0.2; this.musBus.connect(this.master);
        const len = this.ctx.sampleRate * 0.5, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      } catch (e) { this.ctx = null; }
    }
    setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? this.vol : 0; if (this.tracks && this.bgmKind && this.tracks[this.bgmKind]) this.fade(this.tracks[this.bgmKind], v && this.musicOn ? BGM_VOL : 0); }
    setMusic(v) { this.musicOn = v; if (this.musBus) this.musBus.gain.value = v ? 0.2 : 0; if (this.tracks && this.bgmKind && this.tracks[this.bgmKind]) this.fade(this.tracks[this.bgmKind], v && this.on ? BGM_VOL : 0); }
    // 같은 소리가 한 프레임에 수십 번 겹치지 않게
    gate(k, gap) { const now = this.ctx ? this.ctx.currentTime : 0; if (this.last[k] && now - this.last[k] < gap) return false; this.last[k] = now; return true; }
    tone(o) {
      const c = this.ctx; if (!c || !this.on) return;
      const t = c.currentTime + (o.delay || 0);
      const os = c.createOscillator(), g = c.createGain();
      os.type = o.wave || 'square'; os.frequency.setValueAtTime(o.f, t);
      if (o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || o.d));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.v || 0.2, t + (o.a || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0008, t + o.d);
      os.connect(g); g.connect(o.bus || this.sfxBus); os.start(t); os.stop(t + o.d + 0.05);
    }
    noise(o) {
      const c = this.ctx; if (!c || !this.on) return;
      const t = c.currentTime + (o.delay || 0);
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 1200, t);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
      const g = c.createGain(); g.gain.setValueAtTime(o.v || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + o.d);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus); src.start(t); src.stop(t + o.d + 0.05);
    }
    // ---------------------------------------------------------- 효과음 파일(assets/sfx/*.mp3) — 있으면 파일, 없으면 아래 합성
    // [v4.1] rate < 1 이면 음을 낮춰 재생(preservesPitch 끔) — 자주 나는 높은 소리(동전 · 얼음)를 덜 날카롭게
    file(name, vol, rate) {
      if (!this.on || this.noSfx) return false;
      if (!this.pool) this.pool = {};
      let p = this.pool[name];
      if (!p) {
        p = this.pool[name] = { list: [], bad: false, k: 0 };
        for (let i = 0; i < 4; i++) { const a = new window.Audio('assets/sfx/' + name + '.mp3'); a.preload = 'auto'; a.addEventListener('error', () => { p.bad = true; }); p.list.push(a); }
      }
      if (p.bad) return false;
      const a = p.list[p.k++ % p.list.length];
      try { a.currentTime = 0; a.volume = Math.min(1, (vol == null ? 0.7 : vol) * this.vol * 1.4); a.playbackRate = rate || 1; a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = !rate || rate === 1; const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { return false; }
      return true;
    }
    // ---------------------------------------------------------- 효과음
    click() { if (!this.gate('click', 0.05)) return; this.tone({ f: 494, f2: 587, d: 0.06, v: 0.07, wave: 'triangle' }); }   // [v4.8] 첫 터치에 나는 소리: 880→1320Hz 사각파 → 낮은 삼각파(click 파일은 없어 합성만 씀)
    error() { if (!this.gate('err', 0.2)) return; this.tone({ f: 220, f2: 160, d: 0.16, v: 0.15, wave: 'sawtooth' }); }
    dice(dbl) { if (this.file('dice', 0.5, 0.86)) { if (dbl) { this.tone({ f: 660, d: 0.12, v: 0.1, delay: 0.42, wave: 'triangle' }); this.tone({ f: 880, d: 0.2, v: 0.1, delay: 0.52, wave: 'triangle' }); } return; }
      for (let k = 0; k < 5; k++) this.noise({ f: 2400, d: 0.05, v: 0.18, delay: k * 0.06, type: 'bandpass' });
      this.tone({ f: 660, f2: 990, d: 0.1, v: 0.12, delay: 0.32 });
      if (dbl) { this.tone({ f: 990, d: 0.12, v: 0.14, delay: 0.42 }); this.tone({ f: 1320, d: 0.2, v: 0.14, delay: 0.52 }); }
    }
    // v4.1 주사위 박자: 받침에서 떠오를 때 부드러운 휙(0) → 받침에 닿을 때 나무 딱(0.42 · 0.47) → 결과(0.52)
    // [사용자: 주사위 소리 작게 · 살짝 낮게] 딱 = 대역 1.6k→0.6k(이전 3.2k), 결과 = 삼각파 G5 · D6(이전 사각파 C6 · G6)
    diceShow(dbl, ctrl) {
      this.noise({ f: 500, f2: 1100, d: 0.22, v: 0.05, type: 'bandpass' });
      [0.42, 0.47].forEach((t, k) => { this.noise({ f: 1600, f2: 600, d: 0.05, v: 0.1 - k * 0.035, type: 'bandpass', delay: t }); this.tone({ f: 260 - k * 30, d: 0.05, v: 0.06, wave: 'triangle', delay: t }); });
      if (dbl) [0, 4, 7, 12].forEach((s2, k) => this.tone({ f: 523 * Math.pow(2, s2 / 12), d: 0.18, v: 0.1, delay: 0.52 + k * 0.06, wave: 'triangle' }));
      else { this.tone({ f: 784, d: 0.16, v: 0.09, delay: 0.52, wave: 'triangle' }); this.tone({ f: 1175, d: 0.24, v: 0.06, delay: 0.57, wave: 'triangle' }); }
      if (ctrl) this.tone({ f: 440, f2: 880, d: 0.25, v: 0.08, wave: 'triangle', delay: 0.6 });
    }
    // 칸을 밟을 때마다 음이 반음씩 올라가 남은 칸이 줄어드는 긴장감(마지막 칸은 낮고 묵직하게)
    hopStep(n, last) { if (!this.gate('hop', 0.04)) return; if (last) { this.tone({ f: 300, f2: 190, d: 0.16, v: 0.22, wave: 'triangle' }); this.noise({ f: 800, f2: 180, d: 0.14, v: 0.17 }); return; } this.tone({ f: 392 * Math.pow(2, Math.min(12, n) / 12), d: 0.05, v: 0.07, wave: 'triangle' }); }
    hop(last) { if (!this.gate('hop', 0.05)) return; this.tone({ f: last ? 520 : 700, f2: last ? 300 : 900, d: last ? 0.12 : 0.05, v: last ? 0.16 : 0.07, wave: 'triangle' }); }
    // [v4.8] 발사음: 후반에 초당 25번까지 늘어나 시끄러움의 주범 → 전체 초당 6번까지 · 단계로 커지지 않음 · 높은 음과 톱니파를 낮춤
    fire(type, tier) {
      if (!this.gate('f_all', 0.16)) return;
      if (!this.gate('f_' + type, 0.3)) return;
      const v = 0.055;
      if (type === 'fire') { this.noise({ f: 700, f2: 260, d: 0.16, v: v * 1.4 }); this.tone({ f: 170, f2: 90, d: 0.12, v: v, wave: 'triangle' }); }
      else if (type === 'gatling') { this.noise({ f: 1200, f2: 600, d: 0.05, v: v * 1.2, type: 'bandpass' }); this.tone({ f: 110, d: 0.04, v: v * 0.8, wave: 'triangle' }); }
      else if (type === 'bolt') { this.tone({ f: 620, f2: 280, d: 0.12, v: v * 0.8, wave: 'triangle' }); this.noise({ f: 1500, d: 0.07, v: v * 0.5, type: 'bandpass' }); }
      else if (type === 'light') { this.tone({ f: 587, f2: 784, d: 0.14, v: v * 0.8, wave: 'sine' }); }
      else if (type === 'ice') { this.tone({ f: 660, f2: 880, d: 0.1, v: v * 0.7, wave: 'triangle' }); this.noise({ f: 1500, d: 0.05, v: v * 0.3, type: 'bandpass' }); }
      else if (type === 'poison' || type === 'corrode') { this.noise({ f: 1000, f2: 480, d: 0.12, v: v * 1.1, type: 'bandpass' }); this.tone({ f: 360, f2: 240, d: 0.08, v: v * 0.6, wave: 'triangle' }); }
      else if (type === 'railgun') { this.tone({ f: 220, f2: 640, d: 0.12, v: v, wave: 'triangle' }); this.noise({ f: 1200, d: 0.12, v: v * 0.9 }); }
      else if (type === 'mining' || type === 'greed') { this.tone({ f: 587, d: 0.05, v: v * 0.7, wave: 'triangle' }); this.tone({ f: 784, d: 0.07, v: v * 0.5, delay: 0.04, wave: 'triangle' }); }
      else if (type === 'summon') { this.tone({ f: 494, f2: 740, d: 0.16, v: v * 0.8, wave: 'sine' }); }
      else if (type === 'combo') { this.tone({ f: 587, d: 0.05, v: v * 0.8, wave: 'triangle' }); this.tone({ f: 784, d: 0.06, v: v * 0.8, delay: 0.06, wave: 'triangle' }); }
      else if (type === 'beacon') { this.noise({ f: 1300, f2: 500, d: 0.12, v: v * 1.1, type: 'bandpass' }); this.tone({ f: 440, f2: 300, d: 0.08, v: v * 0.6, wave: 'triangle' }); }
      else if (type === 'growth') { this.tone({ f: 698, f2: 880, d: 0.14, v: v * 0.8, wave: 'sine' }); }
      else if (type === 'prism') { this.tone({ f: 660, f2: 990, d: 0.1, v: v * 0.6, wave: 'sine' }); }
      else if (type === 'tyrant') { this.tone({ f: 220, f2: 100, d: 0.14, v: v * 1.1, wave: 'triangle' }); this.noise({ f: 700, d: 0.08, v: v * 0.9 }); }
    }
    react(kind) { if (!this.gate('react', 0.25)) return; this.tone({ f: 220, f2: 620, d: 0.22, v: 0.1, wave: 'triangle' }); this.noise({ f: 1500, f2: 500, d: 0.26, v: 0.1, type: 'bandpass' }); }
    freeze() { if (!this.gate('f_freeze', 0.16)) return; if (this.file('freeze', 0.32, 0.8)) return; this.tone({ f: 1400, f2: 2000, d: 0.2, v: 0.06, wave: 'sine' }); this.noise({ f: 3500, d: 0.15, v: 0.06, type: 'bandpass' }); }
    rail() { if (!this.gate('rail', 0.24)) return; this.tone({ f: 560, f2: 130, d: 0.22, v: 0.09, wave: 'triangle' }); this.noise({ f: 1500, f2: 400, d: 0.18, v: 0.09 }); }   // [v4.8] 높은 톱니파(1200Hz)가 초당 3.6번 났음
    bell() { if (!this.gate('bell', 0.3)) return; [0, 7, 12].forEach((s2, k) => this.tone({ f: 784 * Math.pow(2, s2 / 12), d: 0.6, v: 0.08, wave: 'sine', delay: k * 0.02 })); }
    boom() { if (this.gate('f_boom', 0.09) && this.file('boom', 0.55)) return; if (!this.gate('boom', 0.06)) return; this.noise({ f: 1400, f2: 120, d: 0.45, v: 0.35 }); this.tone({ f: 110, f2: 40, d: 0.35, v: 0.25, wave: 'sine' }); }
    kill(e) { if (!this.gate('kill', 0.1)) return; const big = e && e.big; this.noise({ f: big ? 600 : 900, f2: 160, d: big ? 0.2 : 0.12, v: big ? 0.16 : 0.1 }); this.tone({ f: big ? 160 : 240, f2: big ? 70 : 110, d: big ? 0.18 : 0.1, v: big ? 0.14 : 0.09, wave: 'sine' }); if (e && e.gold && this.gate('killCoin', 0.14)) this.coin(1, true); }
    coin(n, soft) { if (!this.gate('coin', 0.12)) return; if (this.file('coin', soft ? 0.22 : 0.38, soft ? 0.74 : 0.86)) return; for (let k = 0; k < Math.min(3, n || 1); k++) { this.tone({ f: 1046, d: 0.06, v: soft ? 0.04 : 0.07, delay: k * 0.07, wave: 'triangle' }); this.tone({ f: 1397, d: 0.12, v: soft ? 0.04 : 0.07, delay: k * 0.07 + 0.05, wave: 'triangle' }); } }
    build() { if (this.file('build', 0.7)) return; this.tone({ f: 200, f2: 520, d: 0.22, v: 0.14, wave: 'triangle' }); this.noise({ f: 600, d: 0.25, v: 0.2, delay: 0.24 }); this.tone({ f: 120, f2: 60, d: 0.2, v: 0.2, wave: 'sine', delay: 0.24 }); }
    merge(tier) { if (this.file('merge', 0.8)) { if (tier >= 6) this.file('jackpot', 0.6); return; }
      const base = 392 * Math.pow(1.06, tier * 2);
      this.tone({ f: 200, f2: 1200, d: 0.2, v: 0.1, wave: 'sawtooth', slide: 0.18 });
      [0, 4, 7, 12].forEach((s, k) => this.tone({ f: base * Math.pow(2, s / 12), d: 0.25, v: 0.12, delay: 0.18 + k * 0.06, wave: 'square' }));
      this.noise({ f: 6000, f2: 1500, d: 0.4, v: 0.12, type: 'highpass', delay: 0.18 });
      if (tier >= 6) [0, 4, 7, 11, 14].forEach((s, k) => this.tone({ f: 523 * Math.pow(2, s / 12), d: 0.6, v: 0.12, delay: 0.5 + k * 0.08, wave: 'triangle' }));
    }
    tierup() { if (this.file('tierup', 0.55, 0.88)) return; [0, 5, 9, 12].forEach((s, k) => this.tone({ f: 440 * Math.pow(2, s / 12), d: 0.18, v: 0.11, delay: k * 0.07 })); this.tone({ f: 300, f2: 1600, d: 0.4, v: 0.08, wave: 'sine', delay: 0.3 }); }
    strike(type) { if (this.gate('f_strike', 0.2) && this.file('strike', 0.5, 0.9)) return; if (this.pool && this.pool.strike && !this.pool.strike.bad) return; this.tone({ f: 523, f2: 784, d: 0.15, v: 0.14 }); this.noise({ f: 2000, f2: 300, d: 0.35, v: 0.2, delay: 0.05 }); }
    thunder() { if (this.gate('f_thunder', 0.12) && this.file('thunder', 0.45, 0.9)) return; if (!this.gate('thunder', 0.08)) return; this.noise({ f: 5000, f2: 200, d: 0.4, v: 0.25, type: 'lowpass' }); this.tone({ f: 80, f2: 40, d: 0.3, v: 0.15, wave: 'sine' }); }
    dread() { this.tone({ f: 90, f2: 45, d: 0.7, v: 0.25, wave: 'sawtooth' }); this.noise({ f: 400, d: 0.6, v: 0.15 }); }
    thud() { if (this.file('thud', 0.8)) return; this.tone({ f: 90, f2: 35, d: 0.35, v: 0.35, wave: 'sine' }); this.noise({ f: 700, f2: 100, d: 0.3, v: 0.3 }); }
    jackpot() { if (this.file('jackpot', 0.7)) return; [0, 4, 7, 12, 16].forEach((s, k) => this.tone({ f: 659 * Math.pow(2, s / 12), d: 0.2, v: 0.12, delay: k * 0.06 })); this.coin(3); }
    good() { this.tone({ f: 587, d: 0.1, v: 0.1, wave: 'triangle' }); this.tone({ f: 880, d: 0.16, v: 0.1, delay: 0.09, wave: 'triangle' }); }
    bad() { this.tone({ f: 300, f2: 190, d: 0.25, v: 0.12, wave: 'triangle' }); }
    boss() { if (this.file('boss', 0.85)) return; [0, 3, 6].forEach((s, k) => this.tone({ f: 110 * Math.pow(2, s / 12), d: 0.5, v: 0.18, delay: k * 0.18, wave: 'sawtooth' })); this.noise({ f: 300, d: 1, v: 0.2 }); }
    bossSkill() { this.tone({ f: 400, f2: 120, d: 0.5, v: 0.13, wave: 'triangle' }); }
    round() { this.tone({ f: 587, d: 0.1, v: 0.09, wave: 'triangle' }); this.tone({ f: 784, d: 0.16, v: 0.09, delay: 0.1, wave: 'triangle' }); }
    upgrade() { [0, 7, 12].forEach((s, k) => this.tone({ f: 440 * Math.pow(2, s / 12), d: 0.12, v: 0.09, delay: k * 0.05, wave: 'triangle' })); }
    truck() { this.tone({ f: 330, d: 0.1, v: 0.1, wave: 'triangle' }); this.tone({ f: 330, d: 0.1, v: 0.1, delay: 0.15, wave: 'triangle' }); }
    commander() { this.tone({ f: 392, f2: 784, d: 0.3, v: 0.12, wave: 'triangle' }); this.noise({ f: 1800, d: 0.25, v: 0.06, type: 'bandpass' }); }
    win() { if (this.file('win', 0.85)) return; [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, k) => this.tone({ f: 523 * Math.pow(2, s / 12), d: 0.25, v: 0.13, delay: k * 0.12, wave: 'square' })); }
    lose() { if (this.file('lose', 0.85)) return; [0, -3, -6, -10].forEach((s, k) => this.tone({ f: 392 * Math.pow(2, s / 12), d: 0.4, v: 0.13, delay: k * 0.22, wave: 'triangle' })); }
    card() { if (this.file('card', 0.6)) return; this.tone({ f: 880, f2: 1760, d: 0.2, v: 0.12, wave: 'triangle' }); }

    // ---------------------------------------------------------- 배경음(칩튠 시퀀서)
    // 배경음: 생성 파일(assets/sfx/bgm_*.mp3)을 먼저, 못 불러오면 합성음
    music(kind) {
      // [v4.5] 전투곡은 장마다 다르게(초원 = battle, 2~6장 = battle_ch2~6 — 설원 · 화산 · 공장 · 신전 · 심연)
      if (kind === 'battle' && this.chapter > 1) kind = 'battle_ch' + this.chapter;
      if (this.bgmKind === kind) return;
      if (this.fileMusic(kind)) { this.bgmKind = kind; if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; } return; }
      this.musicSynth(kind);
    }
    fileMusic(kind) {
      if (this.noFiles) return false;
      if (!this.tracks) this.tracks = {};
      // 처음 세 곡은 미리, 장별 전투곡은 그 장에 들어갈 때 불러온다(모바일 메모리)
      for (const k of ['lobby', 'battle', 'boss'].concat(kind && !this.tracks[kind] ? [kind] : [])) {
        if (this.tracks[k]) continue;
        const a = new window.Audio('assets/sfx/bgm_' + k + '.mp3'); a.loop = true; a.preload = 'auto'; a.volume = 0;
        a.addEventListener('error', () => { this.noFiles = true; if (this.bgmKind) { const want = this.bgmKind.startsWith('battle') ? 'battle' : this.bgmKind; this.bgmKind = null; this.musicSynth(want); } });
        this.tracks[k] = a;
      }
      const target = this.musicOn && this.on ? BGM_VOL : 0;
      for (const k in this.tracks) {
        const a = this.tracks[k];
        if (k === kind) { a.currentTime = k.startsWith('battle') && this.bgmKind === 'boss' ? a.currentTime : 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); this.fade(a, target, false, k === 'bgm_lobby' || k === 'lobby' ? 0.012 : 0.04); }
        else this.fade(a, 0, true);
      }
      return true;
    }
    fade(a, to, pause, step) {
      clearInterval(a._fade);
      a._fade = setInterval(() => { const d = to - a.volume; if (Math.abs(d) < Math.max(0.03, step || 0)) { a.volume = to; clearInterval(a._fade); if (pause && to === 0) a.pause(); } else a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(d) * (step || 0.04))); }, 40);
    }
    musicSynth(kind) {
      if (!this.ctx || this.bgmKind === kind) return;
      this.bgmKind = kind;
      if (this.bgmTimer) clearInterval(this.bgmTimer);
      if (!kind) { if (this.tracks) for (const k in this.tracks) this.fade(this.tracks[k], 0, true); return; }
      const S = SONGS[kind] || SONGS.battle;
      let step = 0, next = this.ctx.currentTime + 0.1;
      const spb = 60 / S.bpm / 4;
      const tick = () => {
        if (!this.ctx) return;
        while (next < this.ctx.currentTime + 0.2) {
          if (this.musicOn && this.on) this.playStep(S, step, next, spb);
          step = (step + 1) % (S.len * 16); next += spb;
        }
      };
      this.bgmTimer = setInterval(tick, 50); tick();
    }
    playStep(S, step, t, spb) {
      const bar = Math.floor(step / 16), s = step % 16, ch = S.chords[bar % S.chords.length];
      const N = n => 440 * Math.pow(2, (n - 69) / 12);
      const play = (f, d, v, wave, at) => { const os = this.ctx.createOscillator(), g = this.ctx.createGain(); os.type = wave; os.frequency.value = f; g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.0008, at + d); os.connect(g); g.connect(this.musBus); os.start(at); os.stop(at + d + 0.02); };
      // 베이스
      if (S.bass[s]) play(N(ch[0] - 24 + (S.bass[s] === 2 ? 7 : 0)), spb * 1.8, 0.22, 'triangle', t);
      // 아르페지오
      if (S.arp[s]) play(N(ch[S.arp[s] - 1]), spb * 0.9, 0.04, 'triangle', t);   // [v4.8] 파일을 못 불러올 때 대신 나는 칩튠: 한 옥타브 낮추고 사각파 → 삼각파
      // 멜로디
      const mel = S.mel[bar % S.mel.length][s];
      if (mel) play(N(mel - 12), spb * 2.6, 0.06, 'triangle', t);
      // 북
      const kick = S.kick[s], hat = S.hat[s];
      if (kick) { const os = this.ctx.createOscillator(), g = this.ctx.createGain(); os.frequency.setValueAtTime(140, t); os.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); os.connect(g); g.connect(this.musBus); os.start(t); os.stop(t + 0.16); }
      if (hat) { const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000; const g = this.ctx.createGain(); g.gain.setValueAtTime(hat === 2 ? 0.05 : 0.025, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); src.connect(f); f.connect(g); g.connect(this.musBus); src.start(t); src.stop(t + 0.06); }
    }
  }
  // 코드 = [근음, 3음, 5음] (MIDI). 멜로디는 16칸 × 마디
  const C = (r, minor) => [r, r + (minor ? 3 : 4), r + 7];
  const SONGS = {
    lobby: { bpm: 92, len: 4, chords: [C(60), C(57, 1), C(65), C(67)],
      bass: [1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 2, 0], arp: [1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 0, 2, 0],
      mel: [[72, 0, 0, 0, 76, 0, 79, 0, 0, 0, 76, 0, 74, 0, 0, 0], [72, 0, 0, 0, 0, 0, 69, 0, 72, 0, 0, 0, 0, 0, 0, 0], [77, 0, 0, 0, 76, 0, 74, 0, 72, 0, 0, 0, 69, 0, 0, 0], [74, 0, 0, 0, 0, 0, 71, 0, 74, 0, 76, 0, 79, 0, 0, 0]],
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
    battle: { bpm: 128, len: 4, chords: [C(57, 1), C(65), C(60), C(67)],
      bass: [1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 1], arp: [1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2],
      mel: [[81, 0, 0, 79, 0, 0, 76, 0, 77, 0, 76, 0, 74, 0, 72, 0], [77, 0, 0, 76, 0, 0, 72, 0, 74, 0, 0, 0, 72, 0, 69, 0], [76, 0, 0, 74, 0, 0, 72, 0, 74, 0, 76, 0, 79, 0, 0, 0], [79, 0, 0, 0, 77, 0, 76, 0, 74, 0, 0, 0, 71, 0, 0, 0]],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 1, 2, 1] },
    boss: { bpm: 144, len: 4, chords: [C(57, 1), C(58), C(57, 1), C(56)],
      bass: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 2, 0, 1, 0], arp: [1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3],
      mel: [[69, 0, 72, 0, 76, 0, 75, 0, 76, 0, 72, 0, 69, 0, 0, 0], [70, 0, 74, 0, 77, 0, 76, 0, 74, 0, 0, 0, 70, 0, 0, 0], [69, 0, 72, 0, 76, 0, 81, 0, 80, 0, 76, 0, 72, 0, 0, 0], [68, 0, 71, 0, 74, 0, 76, 0, 77, 0, 76, 0, 74, 0, 71, 0]],
      kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1], hat: [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1] },
  };
  root.SFX = new Audio();
})(window);
