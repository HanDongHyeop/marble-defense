// v5.9 층(Renderer에 덧붙임) — 입구에 앉아 있는 다음 보스
// 사용자(2026-11-11): '랜다 영상은 보스가 아예 배치돼 있고 보스에서 잡몹들이 나온다. 보스 idle 모션이 나와야 할 것 같고,
//   보스 웨이브에는 보스가 출격하니 그때는 수정으로 교체돼도 될 것 같다'
// 흐름: 첫 라운드 시작 → 다음 보스(sim.nextBoss)가 위에서 떨어져 입구 굴에 착지(먼지 고리 · 작은 쿵) → 숨쉬기 · 가끔 들썩임(대기)
//   → 잡몹이 나올 때마다 움찔 + 보라 연기(잡몹이 보스 뒤에서 걸어 나옴) → 보스 웨이브: 소개(ui.js) 뒤 그대로 걸어 나가고 자리는 수정(render14)
//   → 보스가 끝나고 수정이 사라지면 다음 보스가 다시 떨어짐
// 그리기: 걷는 보스와 같은 그림 경로(render.js drawMonster의 seat 갈래) · 깊이 정렬도 몬스터와 같이(render4 frame의 seatItem)
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM;
  const rnd = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2;
  const LAND = 0.45;   // 떨어지는 시간

  R.st15 = function () { return this._st15 || (this._st15 = { kind: null, t0: 0, pulse: -9, lastId: null, landed: false, m: null }); };

  R.seatItem = function (game) {
    const S = this.st15(), cr = this.cs14 && this.cs14().cr;
    const want = !game.over && !game.boss && game.nextBoss && !cr ? game.nextBoss : null;
    if (want !== S.kind) { S.kind = want; S.t0 = this.time; S.landed = false; }
    // 새로 나온 잡몹 = 보스가 내보냄
    let top = S.lastId == null ? -1 : S.lastId;
    for (const m of game.monsters) if (m.id > top) { if (S.lastId != null && S.kind && !m.boss && m.kind !== 'truck' && m.f < 0.6) this.seatPuff15(S); top = m.id; }
    S.lastId = Math.max(S.lastId == null ? -1 : S.lastId, top);
    if (!S.kind) return null;
    const p = G.lanePoint(0, 0);
    if (!S.m || S.m.boss !== S.kind) S.m = { seat: true, boss: S.kind, kind: 'boss', id: -1, alive: true, hp: 1, maxHp: 1, hitT: -9, stunUntil: 0, slowUntil: 0, frozenUntil: 0, weight: 0, f: 0, w: 0, face: 1 };
    const m = S.m; m.x = p[0]; m.y = p[1]; m.g = p[2]; m.seatT = this.time - S.t0; m.pulse = this.time - S.pulse;
    if (!S.landed && m.seatT >= LAND) { S.landed = true; this.seatLand15(m); }
    return m;
  };
  // 착지: 먼지 고리 · 흙 부스러기 · 작은 흔들림 · 작은 쿵
  R.seatLand15 = function (m) {
    const x = m.x, y = m.y;
    this.shake = Math.max(this.shake || 0, 5);
    if (this.ring) this.ring(x, y - 4, 64, '#e8d0b0', 0.5, 5);
    for (let q = 0; q < 14; q++) { const a = (q / 14) * Math.PI + Math.PI, sp = rnd(90, 200); this.part({ x: x + rnd(-20, 20), y: y - 2, vx: Math.cos(a) * sp * (q % 2 ? 1 : -1), vy: -rnd(40, 120), grav: 420, drag: 1.2, life: rnd(0.35, 0.6), size: rnd(4, 8), col: q % 3 ? '#c8a878' : '#8a6a4a', kind: 'dot' }); }
    const A = this._A14; if (A && A.file) try { A.file('thud', 0.28, 1.15); } catch (e) { /* 소리 없음 */ }
  };
  // 잡몹을 내보냄: 움찔(drawMonster가 m.pulse로 찌그러짐) + 보라 연기 · 반짝
  R.seatPuff15 = function (S) {
    if (this.time - S.pulse < 0.12) return;   // 몰려 나올 때 연기가 겹겹이 쌓이지 않게
    S.pulse = this.time;
    const p = G.lanePoint(0, 0), x = p[0], y = p[1] - 34 * p[2];
    for (let q = 0; q < 7; q++) { const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1); this.part({ x: x + rnd(-14, 14), y: y + rnd(-6, 6), vx: Math.cos(a) * rnd(30, 80), vy: Math.sin(a) * rnd(30, 70), drag: 1.6, life: rnd(0.4, 0.65), size: rnd(7, 12), col: q % 2 ? '#5a2a6a' : '#3a1a4a', kind: 'dot' }); }
    for (let q = 0; q < 3; q++) this.part({ x: x + rnd(-18, 18), y: y + rnd(-10, 4), vy: -rnd(30, 60), life: 0.45, size: 5, col: '#e8a8ff', kind: 'star', vr: rnd(-6, 6) });
  };
})(window);
