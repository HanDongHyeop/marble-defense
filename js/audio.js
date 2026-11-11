// 소리 — Web Audio 실시간 합성(파일 없음). 효과음 + 칩튠 배경음(로비 · 전투 · 보스).
// 나중에 파일 소리로 바꾸려면 같은 함수 이름으로 갈아끼우면 된다.
(function (root) {
  // [v5.9] 탄 모양 → 발사음(계열 · 단계 무관, 탄 그림 종류 기준 = behave.js attack의 shot kind)
  //   총알 bullet(개틀링) · 빔 beam(레일건 · 프리즘) · 화염 방사 flame(화염 4~6) · 고체 덩어리 lump(화염 1~3 불덩이 · 채굴 돌/금괴 · 탐욕 동전)
  //   날카로운 탄 sharp(빙결 고드름 · 폭군 가시 · 맹독 1~3 침 · 봉화 화살) · 마법 구슬 magic(성광 · 소환 · 콤보 · 성장) · 전기 electric(번개) · 액체 liquid(부식 · 맹독 4~6 독 폭탄)
  const SHOT_OF = (type, t) => ({ gatling: 'bullet', railgun: null, prism: 'beam', fire: t <= 3 ? 'lump' : 'flame', mining: 'lump', greed: 'lump',
    ice: 'sharp', tyrant: 'sharp', beacon: 'sharp', poison: t <= 3 ? 'sharp' : 'liquid', light: 'magic', summon: 'magic', combo: 'magic', growth: 'magic', bolt: 'electric', corrode: 'liquid' })[type];   // 레일건은 rail()이 빔 소리
  // 크기: 파일은 모두 −20dBFS로 맞춤(tools/build_shot59.py). 한 발 = 주사위보다 약 −10dB · 여러 포탑이 쏘는 흐름 = 약 −5dB(첨부 영상: 발사음 흐름이 배경음과 비슷 · 큰 효과음보다 5dB쯤 작음)
  const SHOT_GAIN = { bullet: 0.165, beam: 0.18, flame: 0.16, lump: 0.125, sharp: 0.17, magic: 0.17, electric: 0.17, liquid: 0.16 };   // 측정(파일 RMS + 게인): 종류마다 주사위(−27.8dB)보다 약 −10dB
  const FILES = ['dice', 'coin', 'boom', 'build', 'merge', 'tierup', 'thud', 'strike', 'boss', 'win', 'lose', 'jackpot', 'freeze', 'thunder', 'card'];
  const D = () => root.DATA;
  const BGM_VOL = 1;   // [v5.6] 곡 크기를 파일에 구워 넣음(평소 −31 · 보스 −27 · 로비 −32.5 LUFS) — 아이폰은 소리 크기(volume)를 못 바꿔 늘 1로 났음(전 0.4는 PC에만 먹었다)   // [v4.8] 배경음 크기(전 0.45). 곡별 크기는 파일에서 맞춤(tools/audio_master.py)
  class Audio {
    constructor() {
      this.ctx = null; this.on = true; this.musicOn = true; this.vol = 0.55; this.last = {}; this.bgm = null;
      // [v5.9] 아이폰 본편 무음 고침 — 첫 터치를 pointerdown에서만 받았는데, 터치의 pointerdown은 '소리 허용 동작'이 아니다(pointerup · touchend · click만).
      //   그래서 AudioContext가 잠긴 채 · 배경음 play()가 조용히 거절됐다(로비는 v5.7에 같은 이유로 고침). → 손을 뗄 때마다 다시 켬(잠겨 있을 때만 일함)
      if (typeof document !== 'undefined') { const go = () => this.unlock(); for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, go, true); }
    }
    unlock() {
      this.init();
      const c = this.ctx; if (!c) return;
      if (c.state !== 'running') { try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 막힘 */ } }
      if (!this._warm) { try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); this._warm = true; } catch (e) { /* 없음 */ } }   // 빈 소리 한 번 = 사파리가 출력을 엶
    }
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
        // [v5.9] 효과음 · 탄 발사음 = Web Audio 버퍼(아이폰은 Audio 요소의 volume을 무시해 늘 최대 크기로 났다 → 버퍼 + 게인은 크기가 지켜짐)
        this.shotBus = this.ctx.createGain(); this.shotBus.gain.value = 1; this.shotBus.connect(this.sfxBus);
        for (const n of FILES.concat(Object.keys(SHOT_GAIN).map(k => 'shot_' + k))) this.loadBuf(n);
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
    loadBuf(name) {
      if (!this.ctx) return null;
      const B = this.bufs || (this.bufs = {});
      if (name in B) return B[name];
      if (location.protocol === 'file:') { B[name] = false; return false; }   // 파일 주소는 fetch가 막힘 → Audio 요소로(로컬 확인용)
      B[name] = null;
      fetch('assets/sfx/' + name + '.mp3').then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then(ab => new Promise((res, rej) => { const p = this.ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); }))
        .then(b => { B[name] = b; }, () => { B[name] = false; });
      return null;
    }
    playBuf(b, gain, rate, bus, delay) {
      const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
      s.buffer = b; if (rate) s.playbackRate.value = rate; g.gain.value = gain;
      s.connect(g); g.connect(bus || this.master); s.start(c.currentTime + (delay || 0));
    }
    file(name, vol, rate) {
      if (!this.on || this.noSfx) return false;
      if (this.ctx && this.ctx.state === 'running') { const b = this.loadBuf(name); if (b) { this.playBuf(b, (vol == null ? 0.7 : vol) * 1.4, rate || 1); return true; } }   // master가 this.vol을 곱함 = 예전 a.volume(vol × vol × 1.4)과 같은 크기
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
    // [v5.9] 주사위 소리 −30%(사용자) — 파일 0.5 → 0.35 · 더블 음 0.1 → 0.07, 아래 diceShow도 × 0.7
    dice(dbl) { if (this.file('dice', 0.35, 0.86)) { if (dbl) { this.tone({ f: 660, d: 0.12, v: 0.07, delay: 0.42, wave: 'triangle' }); this.tone({ f: 880, d: 0.2, v: 0.07, delay: 0.52, wave: 'triangle' }); } return; }
      for (let k = 0; k < 5; k++) this.noise({ f: 2400, d: 0.05, v: 0.18, delay: k * 0.06, type: 'bandpass' });
      this.tone({ f: 660, f2: 990, d: 0.1, v: 0.12, delay: 0.32 });
      if (dbl) { this.tone({ f: 990, d: 0.12, v: 0.14, delay: 0.42 }); this.tone({ f: 1320, d: 0.2, v: 0.14, delay: 0.52 }); }
    }
    // v4.1 주사위 박자: 받침에서 떠오를 때 부드러운 휙(0) → 받침에 닿을 때 나무 딱(0.42 · 0.47) → 결과(0.52)
    // [사용자: 주사위 소리 작게 · 살짝 낮게] 딱 = 대역 1.6k→0.6k(이전 3.2k), 결과 = 삼각파 G5 · D6(이전 사각파 C6 · G6)
    diceShow(dbl, ctrl) {
      const K = 0.7, tone = o => this.tone(Object.assign(o, { v: o.v * K })), noise = o => this.noise(Object.assign(o, { v: o.v * K }));   // [v5.9] −30%
      noise({ f: 500, f2: 1100, d: 0.22, v: 0.05, type: 'bandpass' });
      [0.42, 0.47].forEach((t, k) => { noise({ f: 1600, f2: 600, d: 0.05, v: 0.1 - k * 0.035, type: 'bandpass', delay: t }); tone({ f: 260 - k * 30, d: 0.05, v: 0.06, wave: 'triangle', delay: t }); });
      if (dbl) [0, 4, 7, 12].forEach((s2, k) => tone({ f: 523 * Math.pow(2, s2 / 12), d: 0.18, v: 0.1, delay: 0.52 + k * 0.06, wave: 'triangle' }));
      else { tone({ f: 784, d: 0.16, v: 0.09, delay: 0.52, wave: 'triangle' }); tone({ f: 1175, d: 0.24, v: 0.06, delay: 0.57, wave: 'triangle' }); }
      if (ctrl) tone({ f: 440, f2: 880, d: 0.25, v: 0.08, wave: 'triangle', delay: 0.6 });
    }
    // 칸을 밟을 때마다 음이 반음씩 올라가 남은 칸이 줄어드는 긴장감(마지막 칸은 낮고 묵직하게)
    hopStep(n, last) { if (!this.gate('hop', 0.04)) return; if (last) { this.tone({ f: 300, f2: 190, d: 0.16, v: 0.22, wave: 'triangle' }); this.noise({ f: 800, f2: 180, d: 0.14, v: 0.17 }); return; } this.tone({ f: 392 * Math.pow(2, Math.min(12, n) / 12), d: 0.05, v: 0.07, wave: 'triangle' }); }
    hop(last) { if (!this.gate('hop', 0.05)) return; this.tone({ f: last ? 520 : 700, f2: last ? 300 : 900, d: last ? 0.12 : 0.05, v: last ? 0.16 : 0.07, wave: 'triangle' }); }
    // [v5.9] 탄 발사음 = 탄 모양 8종(계열 · 단계 무관). 사용자(2026-11-11): '탄의 형태 종류를 구분해 그에 맞는 효과음 — 불 포탑 1단계는 고체 탄 소리였다가 6단계 화염이면 화염 방사 소리.
    //   계속 나는 소리라 다른 효과음보다 아주 작게(첨부 영상 정도)'. 파일 = assets/sfx/shot_<종류>.mp3(tools/build_shot59.py) · 크기 = SHOT_GAIN
    //   한 번 공격에 탄이 여러 발이면 최대 3번(0.07초 간격) · 종류마다 0.07초 · 전체 초당 약 14번까지 · 음 높이 ±5% 흔들어 기계 소리 반복을 피함
    fire(type, tier) {
      const k = SHOT_OF(type, tier); if (!k) return;
      this.shot(k, type === 'gatling' ? 3 : Math.min(3, (D() && D().TIER && D().TIER.shots ? D().TIER.shots[tier] : 1) || 1));
    }
    shotOf(type, tier) { return SHOT_OF(type, tier); }   // 시험용(test/unit_v59.js)
    shot(k, n) {
      if (!this.on || this.noSfx || !this.ctx || this.ctx.state !== 'running') return;
      const b = this.loadBuf('shot_' + k); if (!b) return;
      for (let j = 0; j < (n || 1); j++) {
        if (!this.gate('s_' + k + j, 0.07) || !this.gate('s_all' + j, 0.07 / (j ? 1 : 1))) continue;
        this.playBuf(b, SHOT_GAIN[k] * (0.85 + Math.random() * 0.3), 0.95 + Math.random() * 0.1, this.shotBus, j * 0.07);
      }
    }
    react(kind) { if (!this.gate('react', 0.25)) return; this.tone({ f: 220, f2: 620, d: 0.22, v: 0.1, wave: 'triangle' }); this.noise({ f: 1500, f2: 500, d: 0.26, v: 0.1, type: 'bandpass' }); }
    freeze() { if (!this.gate('f_freeze', 0.16)) return; if (this.file('freeze', 0.32, 0.8)) return; this.tone({ f: 1400, f2: 2000, d: 0.2, v: 0.06, wave: 'sine' }); this.noise({ f: 3500, d: 0.15, v: 0.06, type: 'bandpass' }); }
    rail() { if (this.ctx && this.bufs && this.bufs.shot_beam) { this.shot('beam', 1); return; } if (!this.gate('rail', 0.24)) return; this.tone({ f: 560, f2: 130, d: 0.22, v: 0.09, wave: 'triangle' }); this.noise({ f: 1500, f2: 400, d: 0.18, v: 0.09 }); }   // [v4.8] 높은 톱니파(1200Hz)가 초당 3.6번 났음
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
    // [v5.6] 두 곡 겹침 고침: 아이폰(사파리)은 a.volume을 바꿔도 늘 1이라 '0까지 줄이고 멈춤'이 끝나지 않아 앞 곡이 계속 났다
    //   → 소리 크기를 못 바꾸는 기기는 바로 멈춤 · 다른 기기도 줄이기는 최대 0.75초 뒤 반드시 멈춤
    volLocked() { if (this._vl == null) { try { const t = new window.Audio(); t.volume = 0.5; this._vl = Math.abs(t.volume - 0.5) > 0.01; } catch (e) { this._vl = false; } } return this._vl; }
    fade(a, to, pause, step) {
      clearInterval(a._fade);
      if (this.volLocked()) { if (to === 0) a.pause(); else if (a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); } return; }   // 끄기 = 멈춤 · 켜기 = 재생
      let n = 0; const cap = pause ? 12 : 140;   // 줄이며 멈추기는 최대 0.5초
      a._fade = setInterval(() => { n++; const d = to - a.volume; if (Math.abs(d) < Math.max(0.03, step || 0) || n > cap) { try { a.volume = to; } catch (e) { /* 막힌 기기 */ } clearInterval(a._fade); if (pause && to === 0) a.pause(); } else a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(d) * (step || 0.04))); }, 40);
    }
    musicSynth(kind) {
      if (!this.ctx || this.bgmKind === kind) return;
      this.bgmKind = kind;
      if (this.bgmTimer) clearInterval(this.bgmTimer);
      if (this.tracks) for (const k in this.tracks) this.fade(this.tracks[k], 0, true);   // [v5.6] 합성음으로 바뀔 때 파일 곡이 남아 겹치지 않게
      if (!kind) return;
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
