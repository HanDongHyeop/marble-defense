// v4.8 햅틱 — 사용자: '사운드와 무조건 일치하는 건 아니고, 물리(실제 오브젝트의 움직임)가 있을 때 들어가기도 한다. 공격 · 처치 · 블루마블 · 버튼 클릭'
// 조사 정리 = _기획/마블디펜스/마블디펜스_v4.8_햅틱.md
// · 원칙(Android 햅틱 원칙 · Apple HIG): 짧고 또렷하게(버튼 10~20ms) · 자주 나는 일은 아주 약하게 · 중요할수록 강하게 · 소리 · 화면과 같은 순간 · 끌 수 있게
// · 소리와 다른 점: 라운드 · 배경음 · 카드 소리는 진동 없음. 탑 집기 · 합칠 자리에 닿음 · 동전 도착 · 포탑 착지처럼 '물체가 닿는 순간'은 소리와 상관없이 진동
// · 예산: 낮은 등급은 1초 안에 켜진 시간이 일정량을 넘으면 건너뜀(손 저림 · 배터리). 높은 등급이 울리는 중엔 낮은 등급이 끼어들지 못함
// · 기기: Android 크롬 = navigator.vibrate(세기 조절이 없어 길이와 간격으로만 표현) / 아이폰 Safari = 진동 API 없음 → 스위치 틱(iOS 26.5부터 실제 터치만 동작한다고 보고됨. 버튼에만 확실히 난다)
(function (root) {
  // [켜짐, 쉼, 켜짐 ...] ms, 등급 p(1 자주 · 약함 ~ 4 드묾 · 강함), 같은 소리 최소 간격 gap(초)
  const P = {
    tap:     { v: [12], p: 2 },                         // 버튼 누름
    select:  { v: [8], p: 2 },                          // 탑 고르기 · 합칠 자리에 닿음
    pick:    { v: [14], p: 2 },                         // 탑 집어 듦
    deny:    { v: [14, 50, 14], p: 2, gap: 0.3 },       // 돈 부족 · 못 놓는 자리
    hop:     { v: [7], p: 1 },                          // 말이 한 칸 밟음
    die:     { v: [14], p: 2 },                         // 주사위가 받침에 닿음(첫 닿음)
    die2:    { v: [9], p: 2 },                          // 주사위 튕김
    land:    { v: [22], p: 3 },                         // 말이 칸에 멈춤
    drop:    { v: [18], p: 2 },                         // 포탑이 땅에 떨어져 닿음
    strike:  { v: [34], p: 3 },                         // 내 포탑 출동
    slam:    { v: [38, 40, 12], p: 3, gap: 0.2 },       // 쿵(땅 울림 + 여운)
    shot:    { v: [7], p: 1, gap: 0.6 },                // 5 · 6단계 공격(자동이라 아주 약하게 · 드물게)
    rail:    { v: [12], p: 1, gap: 0.45 },              // 레일건 반동
    big:     { v: [20, 30, 10], p: 2, gap: 1 },         // 5 · 6단계 주기 공격
    kill:    { v: [7], p: 1, gap: 0.28 },               // 처치(가장 자주 남 — 가장 약하게)
    killBig: { v: [18], p: 2, gap: 0.2 },               // 엘리트 · 큰 몬스터 처치
    coin:    { v: [6], p: 1, gap: 0.1 },                // 동전이 금화 칸에 들어감
    merge:   { v: [8, 30, 10, 30, 22], p: 3 },          // 합치기(점점 세게)
    tierup:  { v: [10, 30, 22], p: 3 },                 // 단계업
    legend:  { v: [10, 30, 14, 30, 20, 40, 44], p: 4 }, // 6단계 탄생
    jackpot: { v: [8, 40, 8, 40, 8, 40, 18], p: 3 },    // 큰돈(동전이 잇달아)
    good:    { v: [10, 40, 16], p: 3, gap: 0.3 },       // 좋은 효과 · 임무 성공
    bad:     { v: [26, 60, 10], p: 3, gap: 0.3 },       // 나쁜 효과(무겁게 내려앉음)
    flip:    { v: [10], p: 2 },                         // 황금열쇠 카드 뒤집힘
    splash:  { v: [30, 70, 10], p: 3 },                 // 무인도 풍덩
    skill:   { v: [36], p: 3, gap: 0.3 },               // 지휘관 기술 · 철거
    boss:    { v: [40, 80, 40, 80, 60], p: 4 },         // 보스 등장(발소리처럼)
    bossHit: { v: [30, 50, 30], p: 3, gap: 0.5 },       // 보스 교란
    quake:   { v: [50, 40, 50, 40, 50], p: 4 },         // 지진
    bossEnd: { v: [50, 60, 30, 60, 18], p: 4 },         // 보스 처치(점점 잦아듦)
    win:     { v: [14, 40, 14, 40, 14, 40, 60], p: 4 },
    lose:    { v: [60, 80, 30, 80, 14], p: 4 },
  };
  const BUDGET = { 1: 110, 2: 240, 3: 420, 4: 1000 };   // 등급별: 최근 1초 켜진 시간이 이 값을 넘으면 건너뜀(ms)

  class Haptic {
    constructor(env) {
      env = env || {};
      this.nav = env.navigator || (typeof navigator !== 'undefined' ? navigator : null);
      this.now = env.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
      this.wait = env.wait || ((f, ms) => setTimeout(f, ms));
      this.on = true;
      this.last = {}; this.busyUntil = 0; this.busyP = 0; this.log = []; this.count = {};
      this.android = !!(this.nav && typeof this.nav.vibrate === 'function');
      this.ios = !this.android && !!(this.nav && (/iP(hone|ad|od)/.test(this.nav.userAgent || '') || (this.nav.platform === 'MacIntel' && this.nav.maxTouchPoints > 1)));
      if (this.ios && typeof document !== 'undefined') this.iosInit();
    }
    setOn(v) { this.on = !!v; if (!v && this.android) { try { this.nav.vibrate(0); } catch (e) { /* 무시 */ } } if (typeof document !== 'undefined' && document.body) document.body.classList.toggle('no-haptic', !v); }
    // 이름으로 울림. delay = 물체가 닿는 순간까지 기다림(초)
    play(name, delay) {
      if (!this.on) return false;
      if (delay > 0) { this.wait(() => this.play(name), delay * 1000); return true; }
      const P0 = P[name]; if (!P0) return false;
      const t = this.now();
      if (P0.gap && t - (this.last[name] == null ? -1e9 : this.last[name]) < P0.gap * 1000) return false;
      if (t < this.busyUntil && P0.p < this.busyP) return false;   // 더 중요한 진동을 끊지 않음
      this.log = this.log.filter(e => t - e[0] < 1000);
      const used = this.log.reduce((a, e) => a + e[1], 0), on = P0.v.reduce((a, v, k) => a + (k % 2 ? 0 : v), 0);
      if (used + on > BUDGET[P0.p]) return false;
      this.last[name] = t; this.log.push([t, on]); this.count[name] = (this.count[name] || 0) + 1;
      this.busyUntil = t + P0.v.reduce((a, v) => a + v, 0); this.busyP = P0.p;
      if (this.android) { try { this.nav.vibrate(P0.v); } catch (e) { /* 무시 */ } }
      else if (this.ios && name !== 'tap') this.iosTicks(P0.v);   // 버튼은 실제 터치 틱이 따로 남
      return true;
    }
    // 게임 사건 → 진동. 소리와 1:1이 아니다(라운드 · 카드 · 처치 금화 소리는 진동 없음, 착지 · 도착은 소리와 상관없이 있음)
    consume(game, events) {
      if (!this.on) return;
      for (const e of events) {
        switch (e.ev) {
          case 'dice': this.play('die', 0.42); this.play('die2', 0.47); if (e.dbl) this.play('good', 0.55); break;   // 주사위가 받침에 닿는 순간(audio diceShow와 같은 박자)
          case 'hop': if (!e.last) this.play('hop'); break;
          case 'land': this.play('land'); break;
          case 'strike': this.play('strike'); break;
          case 'thud': this.play('slam'); break;
          case 'build': this.play('drop', 0.26); break;   // 떨어지는 그림이 땅에 닿는 순간(render 0.26초)
          case 'merge': this.play(e.tier >= 6 ? 'legend' : 'merge'); break;
          case 'tierup': this.play(e.tier >= 6 ? 'legend' : 'tierup'); break;
          case 'fire': if (e.tier >= 5 && e.type !== 'railgun') this.play('shot'); break;
          case 'rail': this.play('rail'); break;
          case 'special': this.play('big'); break;
          case 'kill': if (e.boss) break; this.play(e.big ? 'killBig' : 'kill'); break;
          case 'jackpot': case 'piggy': case 'truckKill': this.play('jackpot'); break;
          case 'salary': if (e.land) this.play('good'); break;   // 평소 월급은 동전 도착으로 충분
          case 'nogold': this.play('deny'); break;
          case 'key': this.play('flip', 0.25); this.play(e.good ? 'good' : 'bad', 0.55); break;
          case 'landFx': this.play(e.good ? 'good' : 'bad'); break;
          case 'shield': case 'missionOk': this.play('good'); break;
          case 'missionFail': case 'downgrade': case 'warn': case 'occupy': this.play('bad'); break;
          case 'island': this.play('splash'); break;
          case 'commander': case 'demolish': case 'destroyed': this.play('skill'); break;
          case 'boss': this.play('boss'); break;
          case 'bossSkill': this.play('bossHit'); break;
          case 'quake': this.play('quake'); break;
          case 'bossDown': this.play('bossEnd'); break;
          case 'over': this.play(e.result === 'win' ? 'win' : 'lose'); break;
        }
      }
    }
    // ---------------------------------------------------------- 아이폰: 진동 API가 없어 Safari 스위치의 틱만 쓸 수 있다
    iosInit() {
      const mk = () => { const l = document.createElement('label'); l.className = 'hp-ios'; l.setAttribute('aria-hidden', 'true'); const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; i.addEventListener('click', e => e.stopPropagation()); l.appendChild(i); return l; };
      this._mk = mk;
      const ready = () => {
        // 스크립트 틱용(iOS 26.4까지만 동작한다고 보고됨)
        this._hidden = mk(); this._hidden.style.cssText = 'position:fixed;left:-99px;top:-99px;width:1px;height:1px;opacity:0;pointer-events:none'; document.body.appendChild(this._hidden);
        // 실제 터치 틱: 모든 단추 위에 투명 라벨을 깐다(눌린 click은 단추까지 그대로 올라간다)
        const dress = el => { if (el.matches && el.matches('button') && !el.querySelector(':scope > .hp-ios')) el.appendChild(mk()); if (el.querySelectorAll) el.querySelectorAll('button').forEach(b => { if (!b.querySelector(':scope > .hp-ios')) b.appendChild(mk()); }); };
        dress(document.body);
        new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(n => { if (n.nodeType === 1 && !n.classList.contains('hp-ios')) dress(n); }); }).observe(document.body, { childList: true, subtree: true });
      };
      if (document.body) ready(); else document.addEventListener('DOMContentLoaded', ready);
    }
    iosTicks(v) {
      if (!this._hidden) return;
      const n = Math.min(3, Math.ceil(v.length / 2));
      for (let k = 0; k < n; k++) this.wait(() => { try { this._hidden.click(); } catch (e) { /* 무시 */ } }, k * 70);
    }
  }
  const api = { Haptic, PATTERNS: P, BUDGET };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { root.HAPTIC = new Haptic(); }
})(typeof window !== 'undefined' ? window : globalThis);
