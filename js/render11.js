// v5.4 층(Renderer에 덧붙임) — 효과 알림 · 땅 기운 연출 다시
// 사용자(2026-11-09): '주사위 뒤 중앙 상단 효과 팝업이 화면을 너무 가림 → 투명(딤드 붓질) 배경 + 글자 모션으로.
//   효과가 너무 약함: 몬스터 이동속도 −25%면 맵의 몬스터마다 위에서 아래로 확 너프되는 이펙트 + 작은 효과음,
//   포탑 버프면 있는 포탑에만 위로 확 올라오는 이펙트, 시간제면 걸려 있는 동안 반짝이다 끝나면 꺼짐'
// · 리본(R.ribbon 호출부는 그대로) → 반투명 붓질 띠(왼쪽에서 쓸려 나옴 · 위아래 흐림 · 끝은 붓 자국) + 글자가 한 자씩 튀어나옴
// · [v5.5] 땅 기운이 닿는 순간(fxWave): 모든 대상에 같은 순간 · 화살표 없이 빛 입자만(세지는 쪽 = 솟는 빛 / 약해지는 쪽 = 쏟아지는 빛) · 소리 한 번
// · [v5.5] 걸려 있는 동안: 발밑 빛 + 떠다니는 빛 알갱이만(느림 = 파란 발밑 고리 · 빠름 = 속도선) · 끝나기 2초 전부터 깜박 → 끝나면 사라짐
// · [v5.5] 합치기 힌트(mergeHints): 짝이 있는 포탑 위 계열 색 두 겹 화살표
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

  // ------------------------------------------------------------ [v5.5] 대상 하나에 닿는 입자(화살표 · 글자 없음)
  // 사용자(2026-11-10): '대상마다 하나씩 화살표가 꽂히는 대신, 오브젝트 없는 입자 효과로 모든 대상에 한 번에 촥~ · 글자 알림은 위 띠 하나로'
  //   세지는 쪽(포탑 버프 · 몬스터 강화) = 발밑에서 빛 줄기가 위로 솟음 / 약해지는 쪽 = 위에서 빛 비가 쏟아져 대상에 부딪혀 퍼짐
  R.fxHit = function (k, x, y, h, big) {
    const col = COL[k], up = !!UP[k], n = big ? 12 : 9;
    if (up) {
      this.addFx(0.45, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.6; c.fillStyle = col[1]; c.beginPath(); c.ellipse(x, y + 6, 26 + p * 26, 10 + p * 9, 0, 0, TAU); c.fill(); c.restore(); }, 'under');
      // 빛 기둥(물체 아님 · 빛만): 발밑에서 위로 확 솟았다가 가늘어지며 사라짐
      this.addFx(0.4, (c, p) => { const hh = (h + 60) * eo(Math.min(1, p / 0.35)), w = 30 * (1 - p * 0.7); c.save(); const gl = c.createLinearGradient(0, y + 6, 0, y - hh); gl.addColorStop(0, col[1]); gl.addColorStop(0.5, col[0]); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.globalAlpha = (1 - p) * 0.55; c.fillStyle = gl; c.fillRect(x - w / 2, y - hh, w, hh + 6); c.restore(); }, 'over');
      for (let q = 0; q < n; q++) this.part({ x: x + rnd(-18, 18), y: y + rnd(-4, 8), vx: rnd(-30, 30), vy: -rnd(320, 520), life: rnd(0.35, 0.5), size: rnd(3, 4.5), col: q % 3 ? col[1] : '#ffffff', kind: 'spark', drag: 2.4 });
      for (let q = 0; q < 3; q++) this.part({ x: x + rnd(-14, 14), y: y - rnd(10, h * 0.6), vx: rnd(-25, 25), vy: -rnd(90, 160), life: 0.55, size: rnd(3, 5), col: col[0], kind: 'star', vr: 6, drag: 1.5 });
    } else {
      const top = y - h * 0.55;
      // 빛 비(물체 아님): 위에서 대상으로 쏟아지는 빛줄기 한 묶음
      this.addFx(0.3, (c, p) => { const yy = top - 120 + eo(Math.min(1, p / 0.5)) * 120, w = 26 * (1 - p * 0.5); c.save(); const gl = c.createLinearGradient(0, yy - 90, 0, yy + 10); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.7, col[0]); gl.addColorStop(1, col[1]); c.globalAlpha = (1 - p) * 0.55; c.fillStyle = gl; c.fillRect(x - w / 2, yy - 90, w, 100); c.restore(); }, 'over');
      for (let q = 0; q < n; q++) this.part({ x: x + rnd(-22, 22), y: top - rnd(60, 110), vx: rnd(-20, 20), vy: rnd(560, 760), life: 0.16, size: rnd(3, 4.5), col: q % 3 ? col[1] : '#ffffff', kind: 'spark', drag: 0 });
      this.later8(0.15, () => {
        this.addFx(0.4, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.75; c.strokeStyle = col[1]; c.lineWidth = 3.5 * (1 - p) + 1; c.beginPath(); c.ellipse(x, y + 4, 14 + p * 26, 5 + p * 9, 0, 0, TAU); c.stroke(); c.restore(); }, 'under');
        for (let q = 0; q < 5; q++) { const a = rnd(Math.PI * 1.05, Math.PI * 1.95); this.part({ x: x + rnd(-8, 8), y: top + 10, vx: Math.cos(a) * rnd(90, 170), vy: Math.sin(a) * rnd(40, 110), grav: 500, life: 0.38, size: rnd(2.5, 4), col: q % 2 ? col[0] : col[1], kind: 'dot', drag: 1 }); }
      });
    }
  };

  // 변신: 판 위 모든 대상에 '같은 순간' 한 번에(움직임은 대상마다 조금씩 달라도 타이밍은 하나) · 소리도 한 번
  R.fxWave = function (game, k) {
    const items = [];
    if (ON_TOWER[k]) { for (const t of game.tiles) if (t.tower) { const [x, y] = G.tiles[t.i].tower; items.push({ x, y, h: 70 + t.tower.tier * 8 }); } }
    else for (const m of game.monsters) if (m.alive) items.push({ x: m.x, y: m.y, h: 34 * (m.g || 1) + (m.boss ? 30 : 0), big: !!m.boss });
    if (!items.length) { this.say(ON_TOWER[k] ? '포탑이 생기면 바로 걸려요' : '몬스터가 나오면 바로 걸려요', '#fff4e0', 360, 330, 1.2, 18); return; }
    for (const it of items.slice(0, 48)) this.fxHit(k, it.x, it.y, it.h, it.big);
    // 판 전체에 옅은 색 물결 한 번(촥)
    const col = COL[k];
    this.addFx(0.35, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.14; c.fillStyle = col[1]; c.fillRect(0, 0, 720, 1280); c.restore(); }, 'under');
    const A = this._A;
    if (A && A.noise && A.gate('fxwave', 0.3)) {
      const up = !!UP[k];
      A.noise({ f: up ? 900 : 3000, f2: up ? 3200 : 700, d: 0.26, v: 0.16, type: 'bandpass' });
      A.tone && A.tone(up ? { f: 660, f2: 1320, d: 0.16, v: 0.05, wave: 'triangle', delay: 0.02 } : { f: 420, f2: 160, d: 0.18, v: 0.06, wave: 'triangle', delay: 0.12 });
    }
  };

  // ------------------------------------------------------------ 걸려 있는 동안 표시(매 프레임 · 가볍게) — 발밑 빛 + 떠다니는 빛 알갱이만(화살표 없음)
  // [v5.6] 발밑 빛(part = 'ground')은 포탑 · 몬스터 아래 층, 떠다니는 알갱이(part = 'motes')는 위 층 — render12의 drawFx 끼움에서 부름
  //   사용자(2026-11-10): '너프 · 버프 원형 이펙트가 몬스터 · 포탑 위 레이어로 나온다 → 아래 레이어로'
  R.fxMarks = function (c, g, part) {
    if (!g || !g.lfx) return;
    const GR = part !== 'motes', MO = part !== 'ground';
    const t = this.time;
    for (const k in D.LANDFX) {
      if (!g.fxOn(k)) continue;
      const left = g.fxLeft(k), blink = left < 2 ? (Math.sin(t * 18) > 0 ? 1 : 0.25) : 1, col = COL[k], up = !!UP[k];
      const motes = (x, y, h, seed, n) => {   // 세지면 위로 오르고, 약해지면 위에서 내려앉는 알갱이
        if (!MO) return;
        for (let q = 0; q < n; q++) {
          const ph = (t * 0.8 + seed * 0.37 + q / n) % 1, sx = x + Math.sin(seed * 7 + q * 3.1) * 15, sy = up ? y - 6 - ph * h : y - h + ph * (h - 6);
          c.save(); c.globalAlpha = blink * 0.9 * (ph < 0.2 ? ph / 0.2 : 1 - (ph - 0.2) / 0.8); this.star(c, sx, sy, 4, 5 - ph * 2, 1.8, t * 2 + q, q % 2 ? '#ffffff' : col[0]); c.restore();
        }
      };
      if (ON_TOWER[k]) {
        g.tiles.forEach((tl, j) => {
          if (!tl.tower) return; const [x, y] = G.tiles[tl.i].tower;
          if (GR) { c.save(); const pa = blink * (0.75 + 0.25 * Math.sin(t * 5 + j)); c.globalAlpha = 0.45 * pa; c.fillStyle = col[1]; c.beginPath(); c.ellipse(x, y + 6, 36, 14, 0, 0, TAU); c.fill();
          const gl = c.createLinearGradient(0, y + 6, 0, y - 70); gl.addColorStop(0, col[1]); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.globalAlpha = 0.2 * pa; c.fillStyle = gl; c.fillRect(x - 26, y - 70, 52, 76); c.restore(); }
          motes(x, y, 72, j, 2);
        });
      } else {
        for (const m of g.monsters) {
          if (!m.alive) continue; const h = 34 * (m.g || 1) + (m.boss ? 30 : 0);
          if (GR && k === 'slow') { c.save(); c.globalAlpha = 0.55 * blink; c.strokeStyle = col[1]; c.lineWidth = 4; c.beginPath(); c.ellipse(m.x, m.y + 2, 18 * (m.g || 1), 7 * (m.g || 1), 0, 0, TAU); c.stroke(); c.restore(); }
          if (GR && k === 'rush') { c.save(); c.globalAlpha = 0.5 * blink; c.strokeStyle = col[1]; c.lineWidth = 2; for (let q = 0; q < 3; q++) { const yy = m.y - 6 - q * 7, ph = (t * 3 + q * 0.3) % 1; c.beginPath(); c.moveTo(m.x - 18 - ph * 10, yy); c.lineTo(m.x - 30 - ph * 10, yy); c.stroke(); } c.restore(); }
          if (GR) { c.save(); c.globalAlpha = 0.4 * blink; c.fillStyle = col[1]; c.beginPath(); c.ellipse(m.x, m.y + 2, 20 * (m.g || 1), 8 * (m.g || 1), 0, 0, TAU); c.fill(); c.restore(); }
          motes(m.x, m.y, h + 10, m.id, 1);
        }
      }
    }
  };
  // ------------------------------------------------------------ [v5.5] 합치기 힌트: 짝이 있는 포탑 위에 계열 색 반투명 두 겹 화살표(︽) · 위아래로 둥실
  // 사용자(2026-11-10): '합칠 수 있으면 포탑 위에 계열 색 반투명 이중 화살표 · 아이들 모션으로 위아래'
  //   짝 계산은 판이 바뀔 때만(0.25초마다) · 말 제안 화살표가 떠 있는 칸은 건너뜀 · 화살표는 포탑마다 박자를 조금씩 어긋나게
  R.mergeHints = function (c, game) {
    const now = this.time;
    if (!this._mh || now - this._mh.t > 0.25) {
      const set = [];
      for (const a of game.tiles) if (a.tower && a.tower.tier < 6 && game.tiles.some(b => b.tower && game.canMerge(a.i, b.i))) set.push(a.i);
      this._mh = { t: now, set };
    }
    const offerI = game.offer && game.t <= game.offer.until ? game.offer.i : -1;
    for (const i of this._mh.set) {
      const t = game.tiles[i]; if (!t.tower || i === offerI) continue;
      const T = D.TOWERS[t.tower.type] || {}, col = (D.FAMC && D.FAMC[T.fam]) || '#ffd23a';
      const Rr = this.towerRect(game, i), x = Rr.cx, y = Rr.y - 30 + Math.sin(now * 3.4 + i * 0.7) * 5;
      c.save(); c.globalAlpha = 0.78; c.lineCap = 'round'; c.lineJoin = 'round';
      for (let k = 0; k < 2; k++) {
        const yy = y + k * 11, a2 = k ? 0.75 : 1;
        c.globalAlpha = 0.78 * a2;
        c.beginPath(); c.moveTo(x - 12, yy + 6); c.lineTo(x, yy - 5); c.lineTo(x + 12, yy + 6);
        c.strokeStyle = 'rgba(43,20,38,.85)'; c.lineWidth = 9; c.stroke();
        c.strokeStyle = col; c.lineWidth = 5; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 9, yy + 2.5); c.lineTo(x, yy - 5.5); c.stroke();
      }
      c.restore();
    }
  };

  // [v5.6] 예전엔 맨 위 캔버스(drawTop)에 그려 포탑 · 몬스터를 덮었음 → render12에서 층을 나눠 부름

  // ------------------------------------------------------------ 알림 띠: 반투명 붓질 + 글자 모션(판을 가리지 않음)
  R.drawRibbon = function (c) {
    const S = this.v47(), r = S.ribbons[0]; if (!r) return;
    const a = this.time - r.t0; if (a >= r.dur) { S.ribbons.shift(); if (S.ribbons[0]) S.ribbons[0].t0 = this.time; return; }
    if (!r.br) { r.br = Array.from({ length: 7 }, (_, k) => ({ y: (k - 3) * 10 + rnd(-2, 2), x0: rnd(-30, 30), x1: 720 + rnd(-60, 20), w: rnd(10, 15), d: rnd(0, 0.08) })); }
    const y = 198, op = clamp((a - (r.dur - 0.3)) / 0.3, 0, 1), pal = r.col ? ['#ffffff', r.col, r.col] : r.good ? ['#fff3b8', '#ffc21c', '#ffe28a'] : ['#f0dcff', '#b07cff', '#d8b8ff'];   // [v5.6] 보스 스킬 = 스킬 색
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
