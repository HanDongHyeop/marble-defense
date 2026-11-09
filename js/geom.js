// 판 기하 — 쿼터뷰 마름모 + 원근. 브라우저(전역 GEOM)와 Node(require) 둘 다에서 쓴다.
// [v4.1] 네 겹 구조(안 → 밖): 가운데 주사위 광장 → 블루마블 판(24칸, 말만 다님) → 포탑 자리 고리(칸마다 앞에 둥근 자리 하나) → 몬스터 길.
// 판 좌표 (U, V): 정사각 판을 위에서 본 좌표(0..S). 출발 = (S, S) 모서리 → 화면에서 마름모의 아래 꼭짓점.
// 칸 번호: 출발 0 → 왼쪽 위로 1..5 → 무인도 6 → 7..11 → 황금열쇠 12 → 13..17 → 우주여행 18 → 19..23.
(function (root) {
  const R2 = Math.SQRT2;
  // a = 판 칸 폭 · b = 판 칸 깊이(짧게) · T = 포탑 고리 폭 · L = 길 폭 · ap = 포탑 자리 간격(칸보다 넓게 부채꼴로 벌림) · rp = 자리 반지름
  const CFG = { W: 720, FIELD_H: 900, cx: 360, top: 104, k: 0.66, p: 0.22, q: 0.18, a: 0.864, b: 0.96, T: 1.2, L: 1.1, ap: 1.0, rp: 0.5, clip: 0.3, dNear: 0.4, dFar: 0.64 };
  // [v4.1 검수] k .72 → .66(가로로 더 넓게)
  // [v4.2] 판 칸 ×1.2(a .72 → .864, b .8 → .96) · 포탑 고리 1.55 → 1.2 · 길 1.25 → 1.1 · 좌우 끝 길이 조금 더 화면 밖(clip .4 → .3) — 화면 폭이 정해져 있어 판을 키운 만큼 고리 · 길이 줄어든다
  // [v4.2] 포탑 자리 부채꼴 ap 1.12 → 1.0(칸 폭의 1.16배) — 포탑이 제 칸 앞에 오도록(사용자 '판 대비 포탑 자리가 안 맞음')
  const O = CFG.L + CFG.T;                         // 판 바깥 경계(길 + 포탑 고리)
  const S = 2 * (O + CFG.b) + 5 * CFG.a;
  // 화면 배율: 길 가운데 선의 왼쪽 · 오른쪽 꼭짓점이 화면 끝에 오도록(길 폭의 clip 만큼 화면 밖으로 잘림 — 사용자 허용 '좌우 절반 가려도 됨')
  const gMid = 1 - CFG.p * 0.5;
  const u = CFG.cx / ((S - CFG.L * (1 - CFG.clip) * 2) / 2 / R2 * 2 * gMid) ;

  function P(U, V) {
    const xp = (U - V) / R2, yp = (U + V) / R2, t = yp / (S * R2);
    const g = 1 - CFG.p * (1 - t), h = (1 - CFG.q) * t + CFG.q * t * t;
    return [CFG.cx + xp * g * u, CFG.top + S * R2 * CFG.k * h * u];
  }
  function gAt(U, V) { return 1 - CFG.p * (1 - (U + V) / R2 / (S * R2)); }

  function zoneOf(i) {
    if (i >= 1 && i <= 5) return 0;   // 아래-왼쪽 변(녹)
    if (i >= 7 && i <= 11) return 1;  // 위-왼쪽 변(청)
    if (i >= 13 && i <= 17) return 2; // 위-오른쪽 변(적)
    if (i >= 19 && i <= 23) return 3; // 아래-오른쪽 변(황)
    return -1;
  }
  function tileRect(i) {
    const { b, a } = CFG, L = O;
    if (i === 0) return [S - L - b, S - L, S - L - b, S - L];
    if (i <= 5) return [S - L - b - i * a, S - L - b - (i - 1) * a, S - L - b, S - L];
    if (i === 6) return [L, L + b, S - L - b, S - L];
    if (i <= 11) { const j = i - 6; return [L, L + b, S - L - b - j * a, S - L - b - (j - 1) * a]; }
    if (i === 12) return [L, L + b, L, L + b];
    if (i <= 17) { const j = i - 12; return [L + b + (j - 1) * a, L + b + j * a, L, L + b]; }
    if (i === 18) return [S - L - b, S - L, L, L + b];
    const j = i - 18; return [S - L - b, S - L, L + b + (j - 1) * a, L + b + j * a];
  }
  // 칸 i 바깥쪽 방향(판 좌표 단위 벡터)
  function outOf(i, cU, cV) {
    const z = zoneOf(i);
    if (z === 0) return [0, 1]; if (z === 1) return [-1, 0]; if (z === 2) return [0, -1]; if (z === 3) return [1, 0];
    return [(cU > S / 2 ? 1 : -1) * Math.SQRT1_2, (cV > S / 2 ? 1 : -1) * Math.SQRT1_2];
  }
  // 포탑 자리(판 좌표): 칸의 '변 방향 위치'를 변 가운데 기준으로 ap/a 배 벌리고, 깊이는 포탑 고리 가운데
  function padUV(i) {
    const z = zoneOf(i); if (z < 0) return null;
    // 깊이: 앞쪽 두 변(화면 아래)은 길 쪽으로, 뒤쪽 두 변은 판 쪽으로 — 포탑 그림은 위로 솟으므로 앞 변 포탑이 판 칸을, 뒤 변 포탑이 뒤 길 몬스터를 덜 가린다
    const [u0, u1, v0, v1] = tileRect(i), cU = (u0 + u1) / 2, cV = (v0 + v1) / 2, k = CFG.ap / CFG.a, m = S / 2, d = CFG.L + CFG.T * (z === 0 || z === 3 ? CFG.dNear : CFG.dFar);
    if (z === 0) return [m + (cU - m) * k, S - d];
    if (z === 1) return [d, m + (cV - m) * k];
    if (z === 2) return [m + (cU - m) * k, d];
    return [S - d, m + (cV - m) * k];
  }
  // 칸: 바닥 네 꼭짓점(화면) · 가운데 · 말이 서는 점(= 칸 가운데) · 포탑이 서는 점(= 바깥 포탑 자리, 모서리 칸은 없음)
  const tiles = [];
  for (let i = 0; i < 24; i++) {
    const [u0, u1, v0, v1] = tileRect(i);
    const quad = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
    const cU = (u0 + u1) / 2, cV = (v0 + v1) / 2, out = outOf(i, cU, cV), z = zoneOf(i);
    const pd = padUV(i) || [cU, cV];
    const [pu, pv] = pd, rp = CFG.rp;
    const padQuad = [];
    for (let n = 0; n < 16; n++) { const an = n / 16 * Math.PI * 2; padQuad.push(P(pu + Math.cos(an) * rp, pv + Math.sin(an) * rp)); }
    tiles.push({
      i, zone: z, corner: z < 0, quad, center: P(cU, cV), out,
      pawn: P(cU, cV),
      tower: P(pu, pv), pad: padQuad, padUV: pd,
      badge: P(cU, cV),
      scale: gAt(pu, pv), tscale: gAt(cU, cV),
      w: Math.max(...quad.map(q => q[0])) - Math.min(...quad.map(q => q[0])),
    });
  }
  // 길: f = 0..24 (칸 번호 기준 진행). w = -1(안쪽) ~ +1(바깥쪽). 변의 칸은 그 칸 포탑 자리 바로 바깥, 모서리 칸은 길 모서리
  function laneAnchor(i) {
    i = ((i % 24) + 24) % 24;
    const c = CFG.L / 2;
    if (i === 0) return [S - c, S - c];
    if (i === 6) return [c, S - c];
    if (i === 12) return [c, c];
    if (i === 18) return [S - c, c];
    const [U, V] = padUV(i), z = zoneOf(i);
    return z === 0 ? [U, S - c] : z === 1 ? [c, V] : z === 2 ? [U, c] : [S - c, V];
  }
  function lanePoint(f, w) {
    f = ((f % 24) + 24) % 24;
    const i = Math.floor(f), r = f - i;
    const [u1, v1] = laneAnchor(i), [u2, v2] = laneAnchor(i + 1);
    let U = u1 + (u2 - u1) * r, V = v1 + (v2 - v1) * r;
    let nu, nv;
    if (Math.abs(v2 - v1) < 1e-6) { nu = 0; nv = V > S / 2 ? 1 : -1; } else { nu = U > S / 2 ? 1 : -1; nv = 0; }
    const off = (w || 0) * CFG.L * (typeof process !== 'undefined' && process.env && process.env.LANEW ? +process.env.LANEW : 0.4);
    U += nu * off; V += nv * off;
    return P(U, V).concat([gAt(U, V)]);
  }
  // 고리 경계 다각형(그리기 · 참조 그림용): d = 바깥에서 들어온 깊이
  function ringPoly(d) { return [P(d, d), P(S - d, d), P(S - d, S - d), P(d, S - d)]; }
  // 가운데 광장 중심(주사위가 놓이는 곳)
  const plaza = P(S / 2, S / 2);

  const GEOM = { CFG, S, O, u, P, gAt, tiles, zoneOf, tileRect, padUV, lanePoint, ringPoly, plaza, R2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = GEOM; else root.GEOM = GEOM;
})(typeof window !== 'undefined' ? window : globalThis);
