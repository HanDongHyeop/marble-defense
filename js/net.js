// 온라인 협동(서버 없음): WebRTC 데이터 채널 + 입력 락스텝.
// 두 기기가 같은 씨앗으로 같은 판을 돌리고, 조작(명령)만 주고받는다. 명령은 '지금 틱 + 지연(D)'에 두 쪽에서 똑같이 적용.
// 연결은 '방 코드'를 복사 · 붙여넣기로 주고받는다(공용 STUN만 사용).
(function (root) {
  const D = 8;   // 입력 지연(틱, 60틱 = 1초)

  // ---------------------------------------------------------------- 락스텝(화면과 무관 — Node 시험 가능)
  class Lockstep {
    constructor(game, me, send) { this.g = game; this.me = me; this.send = send; this.tick = 0; this.remoteUpto = D - 1; this.q = {}; this.out = []; this.lastSent = -1; this.hashes = {}; this.desync = false; this.stalled = 0; }
    issue(c, a) { const t = this.tick + D; const cmd = { t, p: this.me, c, a: a || [] }; (this.q[t] || (this.q[t] = [])).push(cmd); this.out.push(cmd); }
    flush() {
      const upto = this.tick + D - 1;
      if (upto === this.lastSent && !this.out.length) return;
      this.send({ type: 'in', upto, cmds: this.out }); this.out = []; this.lastSent = upto;
    }
    receive(msg) {
      if (msg.type === 'in') { for (const c of msg.cmds) (this.q[c.t] || (this.q[c.t] = [])).push(c); this.remoteUpto = Math.max(this.remoteUpto, msg.upto); }
      if (msg.type === 'hash') { const mine = this.hashes[msg.t]; if (mine != null && mine !== msg.h) this.desync = true; else this.hashes['r' + msg.t] = msg.h; }
    }
    canStep() { return this.remoteUpto >= this.tick; }
    stepOnce(dt, apply) {
      if (!this.canStep()) { this.stalled++; return false; }
      const cmds = (this.q[this.tick] || []).sort((x, y) => x.p - y.p);
      for (const c of cmds) apply(c);
      delete this.q[this.tick];
      this.g.step(dt);
      this.tick++;
      if (this.tick % 300 === 0) {
        const h = Lockstep.hash(this.g); this.hashes[this.tick] = h;
        if (this.hashes['r' + this.tick] != null && this.hashes['r' + this.tick] !== h) this.desync = true;
        this.send({ type: 'hash', t: this.tick, h });
      }
      return true;
    }
    static hash(g) {
      let s = Math.round(g.gold) + '|' + g.stats.kills + '|' + g.monsters.length + '|' + g.round + '|' + (g.partner ? Math.round(g.partner.gold) : 0) + '|';
      for (const t of g.tiles) s += t.tower ? t.tower.type[0] + t.tower.tier : '.';
      let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return h;
    }
  }
  // 명령 적용: p1 = 방장(1P 말), p2 = 손님(2P 말)
  function applyCmd(g, c) {
    const a = c.a;
    if (c.p === 2) {   // 손님이 할 수 있는 것: 2P 굴리기 · 합치기
      if (c.c === 'roll') g.partnerPress();
      if (c.c === 'merge') g.merge(a[0], a[1]);
      return;
    }
    if (typeof g[c.c] === 'function') g[c.c](...a);
  }

  // ---------------------------------------------------------------- WebRTC 연결(방 코드 복사 · 붙여넣기)
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
  function gathered(pc) {
    return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 4000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
  }
  class Link {
    constructor() { this.pc = new RTCPeerConnection({ iceServers: ICE }); this.ch = null; this.onmsg = null; this.onopen = null; this.onclose = null; }
    wire(ch) {
      this.ch = ch;
      ch.onopen = () => this.onopen && this.onopen();
      ch.onclose = () => this.onclose && this.onclose();
      ch.onmessage = e => { try { this.onmsg && this.onmsg(JSON.parse(e.data)); } catch (err) { /* 깨진 메시지 무시 */ } };
    }
    async host() {   // 방 만들기 → 방 코드
      this.wire(this.pc.createDataChannel('marble', { ordered: true }));
      await this.pc.setLocalDescription(await this.pc.createOffer());
      await gathered(this.pc);
      return enc(this.pc.localDescription);
    }
    async join(code) {   // 방 코드 → 답 코드
      this.pc.ondatachannel = e => this.wire(e.channel);
      await this.pc.setRemoteDescription(dec(code));
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      await gathered(this.pc);
      return enc(this.pc.localDescription);
    }
    async accept(code) { await this.pc.setRemoteDescription(dec(code)); }   // 방장: 답 코드 받기
    send(o) { if (this.ch && this.ch.readyState === 'open') this.ch.send(JSON.stringify(o)); }
    close() { try { this.pc.close(); } catch (e) { /* 이미 닫힘 */ } }
  }

  const NET = { Lockstep, applyCmd, Link, D };
  if (typeof module !== 'undefined' && module.exports) module.exports = NET; else root.NET = NET;
})(typeof window !== 'undefined' ? window : globalThis);
