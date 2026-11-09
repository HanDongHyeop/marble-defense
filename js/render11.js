// v5.4 층(Renderer에 덧붙임) — 효과 알림 · 땅 기운 연출 다시
// 사용자(2026-11-09): '주사위 뒤 중앙 상단 효과 팝업이 화면을 너무 가림 → 투명(딤드 붓질) 배경 + 글자 모션으로.
//   효과가 너무 약함: 몬스터 이동속도 −25%면 맵의 몬스터마다 위에서 아래로 확 너프되는 이펙트 + 작은 효과음,
//   포탑 버프면 있는 포탑에만 위로 확 올라오는 이펙트, 시간제면 걸려 있는 동안 반짝이다 끝나면 꺼짐'
// · 리본(R.ribbon 호출부는 그대로) → 반투명 붓질 띠(왼쪽에서 쓸려 나옴 · 위아래 흐림 · 끝은 붓 자국) + 글자가 한 자씩 튀어나옴
// · 땅 기운이 대상에 닿는 순간(fxWave): 좋은 쪽 = 위로 솟는 화살표 두 개 + 빛기둥 / 나쁜 쪽(너프) = 위에서 내리꽂히는 화살표 + 찌그러짐 · 대상마다 짧은 소리(겹치지 않게 간격)
// · 걸려 있는 동안: 포탑 = 발밑 빛 + 위로 올라가는 반짝이, 몬스터 = 머리 위 작은 화살표(느림 = 파란 발밑 고리) · 끝나기 2초 전부터 깜박 → 끝나면 사라짐
// · 그리기 원칙(지침): 오프스크린 캔버스 캐시 없음, 'lighter' 없음, 끝 값 딱 고정
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eob = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const eo = t => 1 - Math.pow(1 - t, 3);
  const PLUM = '#2b1426';
  const ON_TOWER = { atk: 1, aps: 1, crit: 1, apsDown: 1 };
  const UP = { atk: 1, aps: 1, crit: 1, armUp: 1, rush: 1 };      // 대상이 세지는 쪽 = 위로 솟음 / 나머지 = 내리꽂힘(약해짐)
  const COL = { atk: ['#ffd0a0', '#ff8a3a'], aps: ['#fff2a0', '#ffc21c'], crit: ['#d8faff', '#46c8ff'], armDown: ['#fff6c0', '#ffcf3a'], slow: ['#d8f0ff', '#5ab0ff'], armUp: ['#e8dcff', '#9a7ae0'], apsDown: ['#ecd8ff', '#a45ae0'], rush: ['#ffd0d6', '#ff4a5e'] };
  const LBL = { atk: '공격↑', aps: '공속↑', crit: '치명↑', armDown: '방어↓', slow: '느림', armUp: '방어↑', apsDown: '공속↓', rush: '빠름' };

  // ------------------------------------------------------------ 화살표(두꺼운 쐐기 · 자두색 테 · 위아래 그라데이션)
  R.chev = function (c, x, y, s, up, col, a) {
    c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, up ? s : -s);
    const path = () => { c.beginPath(); c.moveTo(0, -16); c.lineTo(18, 2); c.lineTo(9, 2); c.lineTo(9, 14); c.lineTo(-9, 14); c.lineTo(-9, 2); c.lineTo(-18, 2); c.closePath(); };
    path(); c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = PLUM; c.stroke();
    const g = c.createLinearGradient(0, -16, 0, 14); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); c.fillStyle = g; path(); c.fill();
    c.globalAlpha = a * 0.55; c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -12); c.lineTo(10, -2); c.lineTo(0, -2); c.closePath(); c.fill();
    c.restore();
  };

  // ------------------------------------------------------------ 대상 하나에 닿는 순간
  R.fxHit = function (k, x, y, h) {
    const col = COL[k], up = !!UP[k], A = this._A, lbl = LBL[k];
    if (up) {
      // 빛기둥 + 화살표 두 개가 위로 확
      this.addFx(0.55, (c, p) => {
        c.save();
        const a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85, hh = 40 + eo(p) * (h + 70);
        const g = c.createLinearGradient(0, y + 6, 0, y - hh); g.addColorStop(0, col[1]); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalAlpha = a * 0.45; c.fillStyle = g; c.beginPath(); c.ellipse(x, y + 6, 26, 10, 0, 0, TAU); c.fill(); c.fillRect(x - 20, y - hh, 40, hh + 6);
        c.restore();
        for (let j = 0; j < 2; j++) { const q = clamp((p - j * 0.12) / 0.6, 0, 1); if (q <= 0) continue; this.chev(c, x, y - 10 - eo(q) * (h + 34), (0.9 - j * 0.2) * (q < 0.2 ? 0.4 + q * 3 : 1), true, col, q < 0.75 ? 1 : (1 - q) / 0.25); }
      }, 'over');
      for (let q = 0; q < 5; q++) this.part({ x: x + rnd(-16, 16), y: y - rnd(0, 20), vx: rnd(-20, 20), vy: -rnd(140, 240), life: 0.55, size: rnd(3, 5), col: q % 2 ? '#ffffff' : col[0], kind: 'star', vr: 6, drag: 1.5 });
      this.ring(x, y + 6, 30, col[1], 0.45, 5);
      if (A && A.tone && A.gate('fxu', 0.045)) A.tone({ f: 620, f2: 1240, d: 0.12, v: 0.035, wave: 'triangle', slide: 0.1 });
    } else {
      // 위에서 내리꽂힘 → 쿵(대상 머리 쪽에서 찌그러짐) + 먼지
      const top = y - h - 6;
      this.addFx(0.6, (c, p) => {
        const fall = clamp(p / 0.28, 0, 1), yy = top - 110 + fall * fall * 110, sq = fall >= 1 ? Math.max(0, 1 - (p - 0.28) / 0.12) : 0;
        const a = p < 0.7 ? 1 : (1 - p) / 0.3;
        c.save(); c.translate(x, yy); c.scale(1 + sq * 0.35, 1 - sq * 0.3); c.translate(-x, -yy);
        this.chev(c, x, yy, 1.05, false, col, a); c.restore();
        if (fall >= 1) { c.save(); c.globalAlpha = a * 0.8; c.strokeStyle = col[1]; c.lineWidth = 4; c.beginPath(); c.ellipse(x, top + 6, 16 + (p - 0.28) * 70, 6 + (p - 0.28) * 20, 0, 0, TAU); c.stroke(); c.restore(); }
      }, 'over');
      this.later8(0.17, () => {
        for (let q = 0; q < 6; q++) this.part({ x: x + rnd(-10, 10), y: top + 4, vx: rnd(-120, 120), vy: rnd(-60, 10), life: 0.4, size: rnd(3, 5), col: q % 2 ? col[0] : col[1], kind: 'puff', drag: 3 });
        if (A && A.tone && A.gate('fxd', 0.045)) A.tone({ f: 360, f2: 120, d: 0.13, v: 0.05, wave: 'square', slide: 0.1 });
      });
    }
    // 대상 위 짧은 글자
    this.later8(up ? 0.18 : 0.2, () => this.say(lbl, col[0], x, y - h - (up ? 64 : 40), 1.3, 26));
  };

  // 변신: 출발 칸에서 가까운 대상부터 차례로(0.06초 간격 이상) — 포탑 기운은 포탑만, 몬스터 기운은 몬스터만
  R.fxWave = function (game, k) {
    const src = this._fxSrc || [360, 420], items = [];
    if (ON_TOWER[k]) { for (const t of game.tiles) if (t.tower) { const [x, y] = G.tiles[t.i].tower; items.push({ x, y, h: 70 + t.tower.tier * 8, d: Math.hypot(x - src[0], y - src[1]) }); } }
    else for (const m of game.monsters) if (m.alive) items.push({ m, x: m.x, y: m.y, h: 34 * (m.g || 1) + (m.boss ? 30 : 0), d: Math.hypot(m.x - src[0], m.y - src[1]) });
    items.sort((a, b) => a.d - b.d);
    items.slice(0, 40).forEach((it, j) => this.later8(Math.min(1.2, j * 0.06), () => { if (it.m && !it.m.alive) return; this.fxHit(k, it.m ? it.m.x : it.x, it.m ? it.m.y : it.y, it.h); }));
    if (!items.length) this.say(ON_TOWER[k] ? '포탑이 생기면 바로 걸려요' : '몬스터가 나오면 바로 걸려요', '#fff4e0', 360, 330, 1.2, 18);
  };

  // ------------------------------------------------------------ 걸려 있는 동안 표시(매 프레임 · 가볍게)
  R.fxMarks = function (c, g) {
    if (!g || !g.lfx) return;
    const t = this.time;
    for (const k in D.LANDFX) {
      if (!g.fxOn(k)) continue;
      const left = g.fxLeft(k), blink = left < 2 ? (Math.sin(t * 18) > 0 ? 1 : 0.25) : 1, col = COL[k], up = !!UP[k];
      if (ON_TOWER[k]) {
        g.tiles.forEach((tl, j) => {
          if (!tl.tower) return; const [x, y] = G.tiles[tl.i].tower;
          c.save(); const pa = blink * (0.75 + 0.25 * Math.sin(t * 5 + j)); c.globalAlpha = 0.45 * pa; c.fillStyle = col[1]; c.beginPath(); c.ellipse(x, y + 6, 36, 14, 0, 0, TAU); c.fill();
          const gl = c.createLinearGradient(0, y + 6, 0, y - 70); gl.addColorStop(0, col[1]); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.globalAlpha = 0.22 * pa; c.fillStyle = gl; c.fillRect(x - 26, y - 70, 52, 76); c.restore();
          for (let q = 0; q < 2; q++) {   // 위로 올라가는 반짝이(포탑마다 다른 박자)
            const ph = (t * 0.9 + j * 0.37 + q * 0.5) % 1, sx = x + Math.sin(j * 7 + q * 3) * 16, sy = y - 10 - ph * 70;
            c.save(); c.globalAlpha = blink * (ph < 0.2 ? ph / 0.2 : 1 - (ph - 0.2) / 0.8); this.star(c, sx, sy, 4, 6 - ph * 3, 2, t * 2, up ? col[0] : col[1]); c.restore();
          }
          if (!up) this.chev(c, x, y - 96 + Math.sin(t * 4 + j) * 3, 0.6, false, col, 0.9 * blink);
        });
      } else {
        for (const m of g.monsters) {
          if (!m.alive) continue; const h = 34 * (m.g || 1) + (m.boss ? 30 : 0);
          if (k === 'slow') { c.save(); c.globalAlpha = 0.55 * blink; c.strokeStyle = col[1]; c.lineWidth = 4; c.beginPath(); c.ellipse(m.x, m.y + 2, 18 * (m.g || 1), 7 * (m.g || 1), 0, 0, TAU); c.stroke(); c.restore(); }
          if (k === 'rush') { c.save(); c.globalAlpha = 0.5 * blink; c.strokeStyle = col[1]; c.lineWidth = 2; for (let q = 0; q < 3; q++) { const yy = m.y - 6 - q * 7, ph = (t * 3 + q * 0.3) % 1; c.beginPath(); c.moveTo(m.x - 18 - ph * 10, yy); c.lineTo(m.x - 30 - ph * 10, yy); c.stroke(); } c.restore(); }
          c.save(); c.globalAlpha = 0.4 * blink; c.fillStyle = col[1]; c.beginPath(); c.ellipse(m.x, m.y + 2, 20 * (m.g || 1), 8 * (m.g || 1), 0, 0, TAU); c.fill(); c.restore();
          this.chev(c, m.x, m.y - h - 20 + Math.sin(t * 5 + m.id) * 2.5, 0.62, up, col, 0.95 * blink);
        }
      }
    }
  };
  const baseDrawTop = R.drawTop;
  R.drawTop = function (dt) { baseDrawTop.call(this, dt); if (this._g) this.fxMarks(this.top, this._g); };

  // ------------------------------------------------------------ 알림 띠: 반투명 붓질 + 글자 모션(판을 가리지 않음)
  R.drawRibbon = function (c) {
    const S = this.v47(), r = S.ribbons[0]; if (!r) return;
    const a = this.time - r.t0; if (a >= r.dur) { S.ribbons.shift(); if (S.ribbons[0]) S.ribbons[0].t0 = this.time; return; }
    if (!r.br) { r.br = Array.from({ length: 7 }, (_, k) => ({ y: (k - 3) * 10 + rnd(-2, 2), x0: rnd(-30, 30), x1: 720 + rnd(-60, 20), w: rnd(10, 15), d: rnd(0, 0.08) })); }
    const y = 198, op = clamp((a - (r.dur - 0.3)) / 0.3, 0, 1), pal = r.good ? ['#fff3b8', '#ffc21c', '#ffe28a'] : ['#f0dcff', '#b07cff', '#d8b8ff'];
    c.save(); c.globalAlpha = 1 - op; c.lineCap = 'round';
    // 붓질 띠(왼쪽 → 오른쪽으로 쓸림)
    for (const b of r.br) {
      const q = clamp((a - b.d) / 0.26, 0, 1); if (q <= 0) continue;
      const xe = b.x0 + (b.x1 - b.x0) * eo(q), edge = Math.abs(b.y) / 36;
      c.strokeStyle = `rgba(14,8,32,${0.62 * (1 - edge * 0.75)})`; c.lineWidth = b.w; c.beginPath(); c.moveTo(b.x0, y + b.y); c.lineTo(xe, y + b.y); c.stroke();
    }
    // 아래 색 붓선(좋음 금 · 나쁨 보라)
    const ql = clamp((a - 0.1) / 0.3, 0, 1); if (ql > 0) { c.strokeStyle = pal[1]; c.globalAlpha = (1 - op) * 0.85; c.lineWidth = 3; c.beginPath(); c.moveTo(60, y + 38); c.lineTo(60 + 600 * eo(ql), y + 38); c.stroke(); c.globalAlpha = 1 - op; }
    // 제목: 한 자씩 튀어나옴(크게 → 제자리)
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = '700 36px Jua, sans-serif';
    const title = r.title, ws = [...title].map(ch => c.measureText(ch).width), tw = ws.reduce((x, v) => x + v, 0);
    const icon = r.icon ? this.I('i44_' + r.icon) : null, iw = icon ? 54 : 0, fit = Math.min(1, 600 / (tw + iw)), lift = op * 18;
    c.save(); c.translate(360, y - (r.sub ? 10 : 0) - lift); c.scale(fit, fit);
    let x = -(tw + iw) / 2;
    if (icon) { const q = clamp((a - 0.05) / 0.25, 0, 1), s = q < 1 ? eob(q) : 1; c.save(); c.translate(x + 22, 0); c.scale(s, s); c.fillStyle = PLUM; c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.fill(); c.fillStyle = r.good ? '#fff4c8' : '#3a2050'; c.beginPath(); c.arc(0, 0, 21, 0, TAU); c.fill(); c.drawImage(icon, -17, -17, 34, 34); c.restore(); x += iw; }
    const gr = c.createLinearGradient(0, -20, 0, 20); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
    [...title].forEach((ch, i) => {
      const q = clamp((a - 0.08 - i * 0.035) / 0.24, 0, 1); if (q <= 0) { x += ws[i]; return; }
      const s = 1 + (1 - eob(q)) * 0.9, cx = x + ws[i] / 2;
      c.save(); c.translate(cx, 0); c.scale(s, s); c.globalAlpha = (1 - op) * Math.min(1, q * 2.5);
      c.lineJoin = 'round'; c.strokeStyle = PLUM; c.lineWidth = 9; c.strokeText(ch, -ws[i] / 2, 0); c.fillStyle = gr; c.fillText(ch, -ws[i] / 2, 0);
      c.restore(); x += ws[i];
    });
    c.restore();
    // 설명: 아래에서 스르륵
    if (r.sub) {
      const q = clamp((a - 0.28) / 0.25, 0, 1);
      if (q > 0) { c.save(); c.globalAlpha = (1 - op) * q; c.textAlign = 'center'; c.font = '700 20px Jua, sans-serif'; this.outlined(c, r.sub.length > 34 ? r.sub.slice(0, 33) + '…' : r.sub, 360, y + 22 + (1 - eo(q)) * 12 - lift, '#fff6e0', PLUM, 6); c.restore(); }
    }
    c.restore();
    // 들어올 때 반짝이(좋음) / 연기(나쁨) — 띠 양 끝에서
    if (a < 0.05 && !r.burst) { r.burst = true; for (let k = 0; k < 8; k++) this.part({ x: rnd(80, 640), y: y + rnd(-30, 30), vx: rnd(-60, 60), vy: rnd(-120, -30), life: 0.6, size: rnd(3, 6), col: r.good ? '#ffe28a' : '#c890ff', kind: r.good ? 'star' : 'puff', vr: 8, drag: 2 }); }
  };
})(window);
