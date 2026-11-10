// v5.6 층(Renderer에 덧붙임) — 보스 스킬이 '누가 · 무엇을 · 어디에' 했는지 보이게
// 사용자(2026-11-10): '보스 · 몬스터 · 수송차가 겹쳐서 어떤 보스가 어떤 스킬(어떤 색 · 모양 · 입자)을 썼는지, 어느 포탑에 걸렸는지 모르겠다.
//   보스가 포탑에 던지는 효과가 안 보여서 더 헷갈린다'
// 원칙(지침 3-6): 예고(보스가 스킬 색으로 기를 모음 · 머리 위 스킬 표식이 커짐) → 이동(보스에게서 대상 포탑으로 스킬마다 다른 모양이 날아감)
//   → 변신(닿는 순간에 바뀜 — 마녀 · 마술사는 닿기 전까지 원래 포탑 그대로) → 강조(걸려 있는 동안 발밑 고리 + 포탑 위 표식 + 남은 시간)
// 스킬마다 색 · 모양 하나씩(겹치지 않게):
//   파괴왕 = 빨강 · 망치   정전 귀신 = 하늘 · 번개   마녀 = 초록 · 저주 구슬   마술사 = 분홍 · 카드(선물)   지진 거인 = 황토 · 바위   사기꾼 = 금 · 사슬
// 층(지침 3-2): 발밑 고리 = 'under'(포탑 · 몬스터 아래) / 날아가는 것 · 표식 = 'over'(포탑 위)
// 보스가 보낸 사건(e.by)은 여기서 처리하고 옛 층(render · render2 · render4 · render8)의 고리 · 연기 · 가운데 번개로 넘기지 않는다
// 그리기 원칙: 오프스크린 캔버스 캐시 없음 · 'lighter' 없음
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eo = t => 1 - Math.pow(1 - t, 3);
  const PLUM = '#2b1426';
  const SK = {
    destroyer: { col: '#ff4a2a', lt: '#ffc08a', name: '망치 예고', sub: '포탑 2개 · 15초 안에 그 칸에 말을 멈추면 구조', good: false },
    ghost:     { col: '#3fe0ff', lt: '#dafaff', name: '정전', sub: '포탑 3개 · 6초 동안 공격을 멈춤', good: false },
    witch:     { col: '#6dff4a', lt: '#dcffcc', name: '변신 저주', sub: '포탑 1개의 종류가 바뀜 · 단계는 그대로', good: false },
    magician:  { col: '#ff6ad5', lt: '#ffd8f4', name: '프리즘 선물', sub: '낮은 포탑 1개가 프리즘으로 · 아무 포탑과 합쳐짐', good: true },
    quake:     { col: '#e8a040', lt: '#ffe2b4', name: '지진', sub: '포탑 2개의 자리가 맞바뀜', good: false },
    swindler:  { col: '#ffc72a', lt: '#fff2b8', name: '점령', sub: '포탑 1개가 공격 못 함 · 그 칸에 멈추면 되찾음', good: false },
    piggy:     { col: '#ffb0c8', lt: '#fff0f4', name: '저금통', sub: '', good: true },
    goblin:    { col: '#ffd23a', lt: '#fff6c0', name: '황금 고블린', sub: '', good: true },
  };
  R.SK12 = SK;

  // ------------------------------------------------------------ 스킬 표식(작은 그림) — 보스 머리 위 · 포탑 위 · 문서에서 같은 모양
  R.skIcon = function (c, k, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineCap = 'round'; c.lineJoin = 'round';
    const ink = (w, f) => { c.strokeStyle = PLUM; c.lineWidth = w + 3; f(); c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = w; f(); c.stroke(); };
    if (k === 'destroyer') {   // 망치
      c.rotate(-0.6);
      c.fillStyle = PLUM; c.fillRect(-2.6, -2, 5.2, 14); c.fillStyle = '#e0c090'; c.fillRect(-1.2, -1, 2.4, 12);
      c.fillStyle = PLUM; c.fillRect(-9, -10, 18, 10); c.fillStyle = '#ffffff'; c.fillRect(-7.5, -8.5, 15, 7); c.fillStyle = col; c.fillRect(-7.5, -3.5, 15, 2);
    } else if (k === 'ghost') {   // 번개
      const f = () => { c.beginPath(); c.moveTo(3, -11); c.lineTo(-4, 1); c.lineTo(2, 1); c.lineTo(-3, 11); c.lineTo(6, -2); c.lineTo(0, -2); c.closePath(); };
      f(); c.fillStyle = PLUM; c.lineWidth = 4; c.strokeStyle = PLUM; c.stroke(); c.fillStyle = '#ffffff'; f(); c.fill();
    } else if (k === 'witch') {   // 저주 구슬(소용돌이)
      c.fillStyle = PLUM; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill();
      c.strokeStyle = col; c.lineWidth = 2.4; c.beginPath(); for (let a = 0; a < 9; a += 0.3) { const r = a * 0.75; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke();
    } else if (k === 'magician') {   // 카드
      c.rotate(0.25); c.fillStyle = PLUM; this.rr(c, -8, -11, 16, 22, 3); c.fill(); c.fillStyle = '#ffffff'; this.rr(c, -6, -9, 12, 18, 2); c.fill();
      this.star(c, 0, 0, 4, 5.5, 2, 0, col);
    } else if (k === 'quake') {   // 바위 + 금
      c.fillStyle = PLUM; c.beginPath(); c.moveTo(-11, 7); c.lineTo(-8, -5); c.lineTo(0, -10); c.lineTo(9, -4); c.lineTo(11, 7); c.closePath(); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-8, 5); c.lineTo(-6, -4); c.lineTo(0, -7.5); c.lineTo(7, -3); c.lineTo(8.5, 5); c.closePath(); c.fill();
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(-1, -7); c.lineTo(1, -1); c.lineTo(-2, 2); c.lineTo(0, 5); c.stroke();
    } else if (k === 'swindler') {   // 자물쇠 + 사슬
      c.strokeStyle = PLUM; c.lineWidth = 6; c.beginPath(); c.arc(0, -3, 5.5, Math.PI, 0); c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 2.6; c.beginPath(); c.arc(0, -3, 5.5, Math.PI, 0); c.stroke();
      c.fillStyle = PLUM; this.rr(c, -8.5, -3.5, 17, 13, 3); c.fill(); c.fillStyle = '#ffffff'; this.rr(c, -6.5, -1.5, 13, 9, 2); c.fill(); c.fillStyle = col; c.fillRect(-1.2, 0.5, 2.4, 5);
    } else if (k === 'piggy') {
      c.fillStyle = PLUM; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill(); c.fillStyle = col; c.fillRect(-4, -1.5, 8, 3);
    } else {   // goblin = 금화
      c.fillStyle = PLUM; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill(); c.fillStyle = '#ffe36a'; c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill(); c.fillStyle = '#c08a1c'; c.fillRect(-1.2, -4.5, 2.4, 9);
    }
    void ink;
    c.restore();
  };
  // 둥근 배지(바탕 = 스킬 색) 안에 표식 + 남은 시간 고리
  R.skBadge = function (c, k, x, y, r, left) {
    const S = SK[k] || SK.destroyer;
    c.save();
    c.fillStyle = PLUM; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.fill();
    c.fillStyle = S.col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(x, y + r * 0.35, r * 0.85, 0.15 * Math.PI, 0.85 * Math.PI); c.fill();
    if (left != null) { c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 0.5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(left, 0, 1)); c.stroke(); }
    c.restore();
    this.skIcon(c, k, x, y, r / 13, S.col);
  };

  // ------------------------------------------------------------ 보스 자리(머리 · 발)
  R.bossHead = function (b) {
    const M = root.MANIFEST && root.MANIFEST['b_' + b.boss], g = b.g || 1;
    const foot = M ? M.foot * 0.5 * g : 60 * g;
    return { x: b.x, y: b.y - foot, foot: b.y, cy: b.y - foot * 0.55, w: M ? M.w * 0.5 * g : 80 };
  };

  // ------------------------------------------------------------ 날아가는 것(스킬마다 다른 모양)
  R.skFly = function (k, b, i, delay, onHit) {
    const S = SK[k], H = this.bossHead(b), [tx, ty0] = G.tiles[i].tower, ty = ty0 - 34;
    const x0 = H.x, y0 = H.cy, dur = k === 'ghost' ? 0.22 : k === 'swindler' ? 0.42 : 0.55;
    const go = () => {
      const mx = (x0 + tx) / 2, my = Math.min(y0, ty) - (k === 'ghost' ? 0 : 110);
      const at = q => [(1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * mx + q * q * tx, (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * my + q * q * ty];
      if (k === 'ghost') {
        // 번개: 보스 → 포탑 지그재그가 0.22초 동안 깜박이며 뻗음(빛만)
        const seg = []; const n = 9; for (let s = 0; s <= n; s++) { const q = s / n; seg.push([x0 + (tx - x0) * q + (s && s < n ? rnd(-16, 16) : 0), y0 + (ty - y0) * q + (s && s < n ? rnd(-12, 12) : 0)]); }
        this.addFx(0.42, (c, p) => {
          const reach = Math.min(1, p / 0.5), m = Math.max(1, Math.ceil(n * reach)), on = p < 0.5 || Math.sin(p * 60) > -0.2;
          if (!on) return;
          c.save(); c.globalAlpha = p < 0.6 ? 1 : (1 - p) / 0.4; c.lineCap = 'round'; c.lineJoin = 'round';
          for (const [col, w] of [[PLUM, 9], [S.col, 5.5], ['#ffffff', 2]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (let s = 0; s <= m; s++) s ? c.lineTo(seg[s][0], seg[s][1]) : c.moveTo(seg[s][0], seg[s][1]); c.stroke(); }
          c.restore();
        }, 'over');
      } else if (k === 'swindler') {
        // 사슬: 고리가 하나씩 이어지며 포탑까지 뻗었다가 감김
        this.addFx(0.9, (c, p) => {
          const reach = eo(Math.min(1, p / 0.45)), fade = p < 0.7 ? 1 : (1 - p) / 0.3, L = Math.hypot(tx - x0, ty - y0), nL = Math.max(4, Math.floor(L / 16));
          c.save(); c.globalAlpha = fade;
          for (let s = 0; s < nL * reach; s++) { const q = s / nL, x = x0 + (tx - x0) * q, y = y0 + (ty - y0) * q + Math.sin(q * Math.PI) * 18 * (1 - reach), a = Math.atan2(ty - y0, tx - x0) + (s % 2 ? Math.PI / 2 : 0);
            c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = PLUM; c.lineWidth = 6; c.beginPath(); c.ellipse(0, 0, 8, 4.5, 0, 0, TAU); c.stroke(); c.strokeStyle = s % 2 ? S.lt : S.col; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 8, 4.5, 0, 0, TAU); c.stroke(); c.restore(); }
          c.restore();
        }, 'over');
      } else {
        // 망치 · 저주 구슬 · 카드 · 바위: 포물선으로 날아가며 꼬리(빛 알갱이)
        this.addFx(dur, (c, p) => {
          const q = eo(p), [x, y] = at(q), [px, py] = at(Math.max(0, q - 0.08));
          c.save(); c.globalAlpha = 0.55; c.strokeStyle = S.col; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); c.restore();
          this.glow(c, x, y, 30, S.col, 0.85);
          const s = k === 'quake' ? 1.6 : 1.5, rot = k === 'destroyer' ? p * 14 : k === 'magician' ? p * 10 : 0;
          c.save(); c.translate(x, y); c.rotate(rot); this.skIcon(c, k, 0, 0, s, S.col); c.restore();
          if (Math.random() < 0.7) this.part({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-40, 40), vy: rnd(-40, 40), life: 0.35, size: rnd(2.5, 4), col: Math.random() < 0.5 ? S.col : S.lt, kind: k === 'magician' ? 'star' : 'dot', vr: 6, drag: 2 });
        }, 'over');
      }
      this.later8(dur, () => { this.skImpact(k, i); if (onHit) onHit(); });
    };
    if (delay > 0) this.later8(delay, go); else go();
    return delay + dur;
  };

  // 맞는 순간(스킬마다 다른 입자) — 발밑 고리는 아래 층
  R.skImpact = function (k, i) {
    const S = SK[k], [x, y] = G.tiles[i].tower, top = y - 50;
    this.addFx(0.5, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.8; c.strokeStyle = S.col; c.lineWidth = 6 * (1 - p) + 1.5; c.beginPath(); c.ellipse(x, y + 4, 16 + p * 46, 6 + p * 17, 0, 0, TAU); c.stroke(); c.restore(); }, 'under');
    this.addFx(0.22, (c, p) => this.glow(c, x, top, 60 * (0.6 + p * 0.6), S.lt, (1 - p)), 'over');
    const A = this._A;
    if (k === 'destroyer') {
      for (let q = 0; q < 12; q++) { const a = rnd(Math.PI, TAU); this.part({ x, y: top + 20, vx: Math.cos(a) * rnd(120, 260), vy: Math.sin(a) * rnd(120, 260), grav: 700, life: 0.6, size: rnd(3, 5.5), col: q % 3 ? '#8a5a3a' : S.col, kind: 'dot', drag: 0.6 }); }
      this.shake = Math.max(this.shake, 5);
      if (A && A.noise) { A.noise({ f: 500, f2: 120, d: 0.25, v: 0.2 }); A.tone({ f: 180, f2: 80, d: 0.2, v: 0.12, wave: 'square' }); }
    } else if (k === 'ghost') {
      for (let q = 0; q < 10; q++) { const a = rnd(0, TAU); this.part({ x: x + rnd(-10, 10), y: top + rnd(-10, 20), vx: Math.cos(a) * rnd(100, 220), vy: Math.sin(a) * rnd(80, 180), life: 0.22, size: rnd(2.5, 4), col: q % 2 ? '#ffffff' : S.col, kind: 'spark', drag: 3 }); }
      if (A && A.noise && A.gate('sk_ghost', 0.12)) { A.noise({ f: 4000, f2: 1500, d: 0.16, v: 0.12, type: 'bandpass' }); A.tone({ f: 900, f2: 200, d: 0.18, v: 0.07, wave: 'sawtooth' }); }
    } else if (k === 'witch') {
      for (let q = 0; q < 10; q++) this.part({ x: x + rnd(-20, 20), y: top + rnd(-6, 26), vx: rnd(-50, 50), vy: -rnd(30, 90), life: rnd(0.6, 0.9), size: rnd(7, 12), col: q % 2 ? S.col : '#3a8a2a', kind: 'puff', drag: 1.5 });
      this.addFx(1.6, (c, p) => { c.save(); c.globalAlpha = (p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85) * 0.7; c.translate(x, y + 4); c.scale(1, 0.38); c.rotate(p * 3); c.strokeStyle = S.col; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 44, 0, TAU); c.stroke(); for (let s = 0; s < 6; s++) { const a = s / 6 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * 44, Math.sin(a) * 44); c.lineTo(Math.cos(a + 2.1) * 44, Math.sin(a + 2.1) * 44); c.stroke(); } c.restore(); }, 'under');
      this.say('종류가 바뀜', S.lt, x, y - 112, 1.1, 19);
      if (A && A.tone) { A.tone({ f: 300, f2: 620, d: 0.3, v: 0.08, wave: 'sine' }); A.tone({ f: 620, f2: 280, d: 0.3, v: 0.06, wave: 'triangle', delay: 0.12 }); }
    } else if (k === 'magician') {
      const rain = ['#ff6ad5', '#ffd23a', '#5ae6ff', '#7dff5a', '#ffffff'];
      for (let q = 0; q < 16; q++) { const a = rnd(Math.PI * 1.1, Math.PI * 1.9); this.part({ x, y: top, vx: Math.cos(a) * rnd(80, 220), vy: Math.sin(a) * rnd(120, 260), grav: 420, life: rnd(0.6, 0.9), size: rnd(3, 5), col: rain[q % rain.length], kind: q % 3 ? 'dot' : 'star', vr: 8, drag: 1 }); }
      this.say('프리즘 선물!', S.lt, x, y - 112, 1.1, 19);
      if (A && A.tone) [0, 4, 7, 12].forEach((s, n) => A.tone({ f: 660 * Math.pow(2, s / 12), d: 0.12, v: 0.06, wave: 'triangle', delay: n * 0.05 }));
    } else if (k === 'quake') {
      for (let q = 0; q < 12; q++) { const a = rnd(Math.PI * 1.05, Math.PI * 1.95); this.part({ x: x + rnd(-14, 14), y: y, vx: Math.cos(a) * rnd(60, 200), vy: Math.sin(a) * rnd(160, 320), grav: 900, life: 0.7, size: rnd(3.5, 6), col: q % 2 ? '#8a5a3a' : S.col, kind: 'dot' }); }
      for (let q = 0; q < 5; q++) this.part({ x: x + rnd(-24, 24), y: y + rnd(-4, 6), vx: rnd(-40, 40), vy: -rnd(10, 40), life: 0.8, size: rnd(9, 14), col: '#c8a070', kind: 'puff', drag: 1 });
    } else if (k === 'swindler') {
      for (let q = 0; q < 8; q++) { const a = rnd(0, TAU); this.part({ x, y: top + 10, vx: Math.cos(a) * rnd(60, 140), vy: Math.sin(a) * rnd(40, 100), life: 0.4, size: rnd(2.5, 4), col: q % 2 ? '#ffffff' : S.col, kind: 'star', vr: 6, drag: 2 }); }
      if (A && A.tone) { A.tone({ f: 1200, d: 0.05, v: 0.08, wave: 'square' }); A.tone({ f: 800, d: 0.08, v: 0.08, wave: 'square', delay: 0.07 }); }
    }
  };

  // ------------------------------------------------------------ 사건
  const base12 = R.consume;
  R.consume = function (game, events, audio) {
    this._A = audio || this._A; this._game = game;
    const A = audio, keep = [], b = game.boss;
    if (!this.sk12) this.sk12 = { hold: {}, arrive: {}, hexAt: {}, stopBy: {}, charge: null, swap: null };
    const st = this.sk12;
    const blocked = events.some(e => e.ev === 'shield' && e.by);
    for (const e of events) {
      const by = e.by;
      if (e.ev === 'bossCharge') { st.charge = { k: e.boss, t0: this.time }; if (A && A.tone) { A.tone({ f: 220, f2: 660, d: 1.1, v: 0.05, wave: 'triangle' }); A.noise && A.noise({ f: 600, f2: 2400, d: 1.1, v: 0.05, type: 'bandpass' }); } continue; }
      if (e.ev === 'bossSkill') {
        st.charge = null;
        const S = SK[e.boss];
        if (S && !blocked && D.BOSSES[e.boss].kind === 'disrupt') this.ribbon(D.BOSSES[e.boss].name + ' · ' + S.name, S.sub, S.good, null, { dur: 2.4, col: S.col, pri: 1 });
        if (b) { const H = this.bossHead(b); this.addFx(0.5, (c, p) => { const bb = this._game && this._game.boss; if (!bb) return; const h = this.bossHead(bb); this.glow(c, h.x, h.cy, 90 * (0.5 + p), S ? S.col : '#fff', (1 - p)); }, 'over'); void H; }
        if (A && A.noise) A.noise({ f: 1200, f2: 300, d: 0.3, v: 0.12, type: 'bandpass' });
        continue;   // 옛 층의 화면 번쩍임 · 소리는 빼고(진동은 main에서 따로 받음)
      }
      if (!by || !b) { keep.push(e); continue; }
      if (e.ev === 'warn' || e.ev === 'stop' || e.ev === 'occupy') {
        const n = st._n = (st._n || 0) + 1, delay = e.ev === 'stop' ? ((n - 1) % 3) * 0.09 : ((n - 1) % 2) * 0.16;
        if (e.ev === 'stop') st.stopBy[e.i] = 'ghost';
        st.arrive[e.i] = this.time + this.skFly(by, b, e.i, delay);   // 표식은 날아간 것이 닿은 뒤부터
        continue;
      }
      if (e.ev === 'hexed') {
        // 닿기 전까지는 원래 종류로 그림(변신 = 맞는 순간)
        st.hold[e.i] = { from: e.from, until: this.time + 0.56 };
        this.skFly(by, b, e.i, 0, () => { delete st.hold[e.i]; st.hexAt[e.i] = { t: this.time, k: by }; });
        continue;
      }
      if (e.ev === 'quake') {
        // 보스가 땅을 내려찍음 → 땅 물결이 두 포탑까지 → 두 포탑이 들렸다가 맞바뀜(맞바뀐 두 칸을 잇는 화살표)
        const H = this.bossHead(b), S = SK.quake;
        this.addFx(0.7, (c, p) => { const bb = this._game.boss || b; c.save(); for (let r = 0; r < 3; r++) { const q = clamp(p * 1.4 - r * 0.15, 0, 1); if (q <= 0 || q >= 1) continue; c.globalAlpha = (1 - q) * 0.7; c.strokeStyle = S.col; c.lineWidth = 7 * (1 - q) + 2; c.beginPath(); c.ellipse(bb.x, bb.y, 30 + q * 260, 12 + q * 100, 0, 0, TAU); c.stroke(); } c.restore(); }, 'under');
        this.shake = Math.max(this.shake, 12);
        for (const i of [e.a, e.b]) this.later8(0.3, () => this.skImpact('quake', i));
        st.swap = { a: e.a, b: e.b, t0: this.time + 0.3 };
        void H;
        if (A && A.thud) A.thud();
        if (A && A.noise) A.noise({ f: 180, f2: 60, d: 0.6, v: 0.25 });
        continue;
      }
      if (e.ev === 'warnStop') { st.stopBy[e.i] = 'destroyer'; keep.push(e); continue; }
      keep.push(e);
    }
    base12.call(this, game, keep, audio);
  };

  // ------------------------------------------------------------ 걸린 포탑 그리기: 정전 · 점령 = 흐리게 / 저주 맞기 전 = 원래 종류
  const tower12 = R.drawTower;
  R.drawTower = function (c, game, i, opt) {
    const st = this.sk12, tl = game && game.tiles && game.tiles[i], tw = tl && tl.tower;
    if (!st || !tw || (opt && opt.at)) return tower12.call(this, c, game, i, opt);
    const h = st.hold[i];
    const off = (game.t < tl.stopUntil || tl.occ) && !(st.arrive[i] > this.time);
    if (h && this.time < h.until) { const t0 = tw.type; tw.type = h.from; try { return tower12.call(this, c, game, i, opt); } finally { tw.type = t0; } }
    if (off) { c.save(); c.globalAlpha *= 0.55; try { return tower12.call(this, c, game, i, opt); } finally { c.restore(); } }
    return tower12.call(this, c, game, i, opt);
  };

  // ------------------------------------------------------------ 매 프레임: 발밑(아래 층) · 표식(위 층)
  R.bossMarks = function (c, game, layer) {
    const st = this.sk12 || (this.sk12 = { hold: {}, arrive: {}, hexAt: {}, stopBy: {}, charge: null, swap: null }), t = this.time, b = game.boss;
    // 보스: 발밑 스킬 색 고리(늘) + 기 모으기(예고)
    if (b && b.alive) {
      const S = SK[b.boss] || SK.destroyer, H = this.bossHead(b), ch = st.charge && t - st.charge.t0 < 1.4 ? (t - st.charge.t0) / 1.2 : -1;
      if (layer === 'under') {
        c.save(); const pu = 0.5 + 0.5 * Math.sin(t * 4);
        c.globalAlpha = 0.35 + 0.15 * pu; c.fillStyle = S.col; c.beginPath(); c.ellipse(b.x, b.y + 2, H.w * 0.42 + pu * 4, H.w * 0.16 + pu * 1.5, 0, 0, TAU); c.fill();
        c.globalAlpha = 0.8; c.strokeStyle = S.col; c.lineWidth = 3; c.beginPath(); c.ellipse(b.x, b.y + 2, H.w * 0.5 + pu * 4, H.w * 0.19 + pu * 1.5, 0, 0, TAU); c.stroke();
        if (ch >= 0) { const q = clamp(ch, 0, 1); c.globalAlpha = 0.85; c.lineWidth = 5; c.beginPath(); c.ellipse(b.x, b.y + 2, H.w * (1.6 - q * 1.05), H.w * (0.6 - q * 0.4), 0, 0, TAU); c.stroke(); }
        c.restore();
      } else {
        if (ch >= 0) {
          const q = clamp(ch, 0, 1);
          this.glow(c, H.x, H.cy, 50 + q * 40, S.col, 0.35 + 0.4 * q);
          for (let n = 0; n < 10; n++) { const a = n / 10 * TAU + t * 3, rr = 130 * (1 - ((q * 1.6 + n * 0.1) % 1)); this.star(c, H.x + Math.cos(a) * rr, H.cy + Math.sin(a) * rr * 0.6, 4, 5, 2, t * 4 + n, n % 2 ? '#ffffff' : S.col); }
        }
        const bob = Math.sin(t * 3) * 3, big = ch >= 0 ? 1 + 0.35 * clamp(ch, 0, 1) + 0.08 * Math.sin(t * 20) : 1;
        if (D.BOSSES[b.boss].kind === 'disrupt') this.skBadge(c, b.boss, H.x, H.y - 20 + bob, 18 * big);
      }
    }
    // 걸린 포탑
    for (const tl of game.tiles) {
      const i = tl.i; if (!tl.tower) continue;
      if (st.arrive[i] > t) continue;
      const [x, y] = G.tiles[i].tower, Rr = this.towerRect(game, i), topY = Rr ? Rr.y : y - 70;
      const warn = tl.warn, stop = game.t < tl.stopUntil, occ = tl.occ;
      if (!warn && !stop && !occ) continue;
      const k = warn ? 'destroyer' : occ ? 'swindler' : (st.stopBy[i] || 'ghost'), S = SK[k];
      if (layer === 'under') {
        c.save(); const fast = warn ? clamp(1 - (warn.until - game.t) / 15, 0, 1) : 0, pu = 0.5 + 0.5 * Math.sin(t * (6 + fast * 12));
        c.globalAlpha = 0.28 + 0.2 * pu; c.fillStyle = S.col; c.beginPath(); c.ellipse(x, y + 4, 40, 15, 0, 0, TAU); c.fill();
        c.globalAlpha = 0.9; c.strokeStyle = S.col; c.lineWidth = 3.5; c.setLineDash(k === 'ghost' ? [8, 6] : k === 'swindler' ? [3, 5] : []); c.lineDashOffset = -t * 20;
        c.beginPath(); c.ellipse(x, y + 4, 44 + pu * 3, 17 + pu, 0, 0, TAU); c.stroke(); c.setLineDash([]);
        if (warn) { c.lineWidth = 3; for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2 + t * 0.8; c.beginPath(); c.moveTo(x + Math.cos(a) * 50, y + 4 + Math.sin(a) * 19); c.lineTo(x + Math.cos(a) * 60, y + 4 + Math.sin(a) * 23); c.stroke(); } }
        c.restore();
      } else {
        // 포탑 위 표식 + 남은 시간
        const left = warn ? (warn.until - game.t) / 15 : stop ? (tl.stopUntil - game.t) / 6 : null;
        const bx = x, by = topY - 24 + Math.sin(t * 4 + i) * 2;
        if (stop && !warn) {   // 정전: 포탑 둘레에 튀는 전기
          c.save(); c.globalAlpha = 0.85; c.lineCap = 'round';
          for (let s = 0; s < 2; s++) { const a = t * 7 + s * 3 + i, r0 = 22; const pts = [0, 1, 2, 3].map(q => [x + Math.cos(a + q * 0.35) * (r0 + (q % 2) * 8), y - 30 + Math.sin(a + q * 0.35) * 22]); for (const [col, w] of [[PLUM, 5], [S.col, 2.5]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach((p, q) => q ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); } }
          c.restore();
        }
        if (occ) {   // 점령: 포탑을 가로지르는 사슬 X
          c.save(); c.globalAlpha = 0.9;
          for (const sd of [-1, 1]) for (let s = 0; s < 6; s++) { const q = s / 5, xx = x - 26 + q * 52, yy = topY + 18 + (sd > 0 ? q : 1 - q) * 46; c.save(); c.translate(xx, yy); c.rotate(sd * 0.75 + (s % 2 ? Math.PI / 2 : 0)); c.strokeStyle = PLUM; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 6, 3.5, 0, 0, TAU); c.stroke(); c.strokeStyle = S.col; c.lineWidth = 2.4; c.beginPath(); c.ellipse(0, 0, 6, 3.5, 0, 0, TAU); c.stroke(); c.restore(); }
          c.restore();
        }
        this.skBadge(c, k, bx, by, 20, left);
        const txt = warn ? Math.ceil(warn.until - game.t) + '초' : stop ? Math.ceil(tl.stopUntil - game.t) + '초' : '멈추면 탈환';
        c.save(); c.font = '700 19px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; this.outlined(c, txt, bx, by - 34, warn ? '#ffd0c0' : S.lt, PLUM, 5); c.restore();
      }
    }
    // 저주 · 선물 맞은 포탑: 1.6초 강조
    if (layer === 'over') {
      for (const i in st.hexAt) {
        const h = st.hexAt[i], a = t - h.t; if (a > 1.6) { delete st.hexAt[i]; continue; }
        const [x, y] = G.tiles[i].tower, Rr = this.towerRect(game, +i); if (!Rr) continue;
        const S = SK[h.k]; c.save(); c.globalAlpha = 1 - a / 1.6; this.skBadge(c, h.k, x, Rr.y - 24, 20); c.restore();
        void S; void y;
      }
      // 지진: 맞바뀐 두 칸을 잇는 양쪽 화살표
      const sw = st.swap;
      if (sw) {
        const a = t - sw.t0;
        if (a > 1.8) st.swap = null;
        else if (a > 0) {
          const S = SK.quake, [x1, y1] = G.tiles[sw.a].tower, [x2, y2] = G.tiles[sw.b].tower, mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 120, q = eo(clamp(a / 0.4, 0, 1)), op = a > 1.4 ? (1.8 - a) / 0.4 : 1;
          c.save(); c.globalAlpha = op; c.lineCap = 'round'; c.setLineDash([14, 9]); c.lineDashOffset = -t * 40;
          const P = s => [(1 - s) * (1 - s) * x1 + 2 * (1 - s) * s * mx + s * s * x2, (1 - s) * (1 - s) * (y1 - 60) + 2 * (1 - s) * s * my + s * s * (y2 - 60)];
          for (const [col, w] of [[PLUM, 9], [S.col, 5]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (let s = 0; s <= 20 * q; s++) { const p = P(s / 20); s ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke(); }
          c.setLineDash([]);
          for (const [s0, s1] of [[0.94, 1], [0.06, 0]]) { if (q < 0.99) continue; const p0 = P(s0), p1 = P(s1), an = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); c.save(); c.translate(p1[0], p1[1]); c.rotate(an); c.fillStyle = PLUM; c.beginPath(); c.moveTo(8, 0); c.lineTo(-12, -11); c.lineTo(-12, 11); c.closePath(); c.fill(); c.fillStyle = S.col; c.beginPath(); c.moveTo(4, 0); c.lineTo(-9, -7); c.lineTo(-9, 7); c.closePath(); c.fill(); c.restore(); }
          c.restore();
          this.skBadge(c, 'quake', mx, my + 10, 14);
        }
      }
    }
  };

  // 아래 층 · 위 층에 끼워 넣기(포탑 · 몬스터 아래 = drawFx 'under' 직후 / 위 = drawFx 'over' 직전)
  const fx12 = R.drawFx;
  R.drawFx = function (c, layer) {
    const g = this._game;
    if (layer === 'over' && g) { if (this.fxMarks) this.fxMarks(c, g, 'motes'); this.bossMarks(c, g, 'over'); }
    fx12.call(this, c, layer);
    if (layer === 'under' && g) { if (this.fxMarks) this.fxMarks(c, g, 'ground'); this.bossMarks(c, g, 'under'); }
  };
})(window);
