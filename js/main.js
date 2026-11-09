// 시작 · 그림 불러오기 · 화면 맞춤 · 메인 루프. 확인용 주소 옵션: ?qa=bot&seed=3&t=60&speed=4&scene=lobby|cards|result|play
// [v5.3] ?embed=1&og={choice,bonus,meta} = 아웃게임 시안(proto/outgame.html) 안에서 판만 바로 연다 — 로비 없이 시작, 'go'를 받을 때까지 멈춤, 끝나면 결과를 부모 창에 보낸다
(function (root) {
  const $ = id => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const EMBED = Q.get('embed') === '1';
  window.addEventListener('unhandledrejection', e => { const b = $('errbox'); b.hidden = false; b.textContent += 'Promise: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason) + '\n'; });
  window.addEventListener('error', e => { const b = $('errbox'); b.hidden = false; b.textContent += (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno + '\n'; });

  const App = {
    game: null, paused: false, img: {}, embed: EMBED, hold: false,
    load() {
      const keys = ['board'];
      for (const k in MANIFEST) { if (k === 'board') continue; keys.push(k); if (MANIFEST[k].white) keys.push(k + '_w'); if (MANIFEST[k].grey) keys.push(k + '_g'); if (MANIFEST[k].back) { keys.push(k + '_b'); if (MANIFEST[k].white) keys.push(k + '_bw'); } }
      let left = keys.length;
      return new Promise(res => {
        const total = left; let lastP = -1;
        const done = () => { const pr = Math.floor((1 - (left - 1) / total) * 100); if (EMBED && pr !== lastP && pr % 5 === 0) { lastP = pr; this.post({ type: 'progress', p: pr }); } if (--left === 0) res(); };   // [v5.3] 진행률 → 시안 진입 막
        for (const k of keys) {
          const im = new Image(); im.onload = done; im.onerror = () => { console.warn('그림 없음', k); done(); };
          im.src = 'assets/img/' + (k === 'board' || (MANIFEST[k] && MANIFEST[k].jpg) ? k + '.jpg' : k + '.png'); this.img[k] = im;
        }
      });
    },
    fit() {
      const W = window.innerWidth, H = window.innerHeight;
      const s = Math.min(W / 720, H / 1280);
      $('stage').style.transform = `scale(${s})`;
      this.scale = s;
      const dpr = Math.min(2, (window.devicePixelRatio || 1) * s);
      const R = Math.max(1, Math.min(2, dpr));
      if (R !== this.R) {
        this.R = R;
        for (const [id, w, h] of [['world', 720, 900], ['top', 720, 1280]]) { const c = $(id); c.width = Math.round(w * R); c.height = Math.round(h * R); c.getContext('2d').setTransform(R, 0, 0, R, 0, 0); }
      }
    },
    start(choice, seedIn) {
      if (this.net && this.net.open && this.net.role === 'host' && !seedIn) { seedIn = (Date.now() & 0xffffff) || 7; choice = Object.assign({}, choice, { coop: 'human', mode: 'conquest' }); this.net.link.send({ type: 'start', seed: seedIn, choice }); }
      if (this.net && this.net.open) choice = Object.assign({}, choice, { coop: 'human', mode: 'conquest' });
      this.ui.reset();
      this.renderer.fx = []; this.renderer.parts = []; this.renderer.texts = []; this.renderer.coins = []; this.renderer.towerAnim = {}; this.renderer.dice = null;
      const seed = seedIn || +(Q.get('seed') || 0) || (Date.now() & 0xffffff);
      const deck = Array.isArray(choice.deck) && choice.deck.length === 5 ? choice.deck : DATA.DECK;
      this.game = new SIM.Game({ seed, commander: choice.commander, pawn: choice.pawn, mode: choice.mode, deck, diff: choice.diff || 'normal', chapter: choice.mode === 'endless' ? 1 : (choice.chapter || 1), meta: META.bonus(this.embedMeta || META.load()), coop: choice.mode !== 'endless' && choice.coop ? (choice.coop === 'human' ? 'human' : true) : false, autoTier: !this.net && (() => { try { return JSON.parse(localStorage.getItem('marble_autoTier') || 'false'); } catch (e) { return false; } })(), pity: (() => { try { return JSON.parse(localStorage.getItem('marble_cardPity') || 'null'); } catch (e) { return null; } })() || undefined });
      this.renderer.boardKey = this.game.CH.board;
      if (this.net && this.net.open) {
        const net = this.net; net.ls = new NET.Lockstep(this.game, net.role === 'host' ? 1 : 2, m => net.link.send(m));
        for (const m of net.early || []) net.ls.receive(m); net.early = [];
        this.acc = 0;
      }
      this.ui.buildDeck(deck);
      $('cmdImg').src = 'assets/img/c_' + choice.commander + '.png';
      $('cmdTag').textContent = DATA.COMMANDERS[choice.commander].name;
      $('pawnImg').src = 'assets/img/p_' + choice.pawn + '.png';
      $('pawnName').textContent = DATA.PAWNS[choice.pawn].name;
      this.paused = false;
      SFX.chapter = this.game.chapter;   // [v4.5] 장별 전투곡
      SFX.music('battle');
    },
    // 조작 하나 = 명령 하나(온라인이면 락스텝 큐로, 아니면 바로)
    cmd(name, a) {
      const g = this.game; if (!g) return false;
      a = a || [];
      if (this.net && this.net.ls) {
        if (this.net.role === 'guest') {
          if (name === 'partnerPress' || name === 'roll') { this.net.ls.issue('roll'); return true; }
          if (name === 'merge') { this.net.ls.issue('merge', a); return true; }
          this.ui.toast('온라인 2P', '굴리기 · 합치기만 할 수 있어요', '카드 · 강화 · 지휘관은 1P', true, 1.4); return false;
        }
        this.net.ls.issue(name, a); return true;
      }
      return typeof g[name] === 'function' ? g[name](...a) : false;
    },
    netCreate(role) {
      this.netClose();
      const link = new NET.Link(); const net = this.net = { role, link, open: false, ls: null };
      link.onopen = () => { net.open = true; SFX.good && SFX.good(); this.ui.toast('온라인', '연결됨!', role === 'host' ? '로비에서 [시작!]' : '1P를 기다리는 중', false, 2); if (this.ui.modalOpen()) this.ui.onlineModal(role === 'host' ? 'host' : 'join'); };
      link.onclose = () => { if (this.net !== net) return; this.ui.toast('온라인', '연결이 끊겼어요', '이 판은 혼자 이어 갑니다(동료는 AI)', true, 3); if (this.game && this.game.partner) this.game.partner.human = false; this.net = null; };
      link.onmsg = m => {
        if (m.type === 'start' && role === 'guest') { this.ui.close(); this.start(m.choice, m.seed); return; }
        if (net.ls) net.ls.receive(m); else (net.early || (net.early = [])).push(m);
      };
    },
    netClose() { if (this.net) { const n = this.net; this.net = null; n.link.close(); } },
    toLobby() {
      if (this.embed) { this.paused = true; SFX.music(null); this.post({ type: 'quit' }); return; }   // [v5.3] 시안 안: 판 포기 → 시안 로비로
      this.game = null; this.paused = false; this.ui.lobby(); SFX.music('lobby');
    },
    // [v5.3] 시안(부모 창)과 주고받기
    post(m) { try { if (window.parent !== window) window.parent.postMessage(Object.assign({ src: 'mdg' }, m), '*'); } catch (e) { /* 부모 없음 */ } },
    embedStart() {
      let o = {}; try { o = JSON.parse(Q.get('og') || '{}'); } catch (e) { o = {}; }
      this.embedMeta = o.meta || null;
      this.start(Object.assign({ commander: 'gambler', pawn: 'car', mode: 'conquest', deck: DATA.DECK }, o.choice || {}));
      const g = this.game, b = o.bonus || {};
      if (b.gold) g.gold += b.gold;
      if (b.free) g.freeRolls = (g.freeRolls || 0) + b.free;
      if (b.gdice) g.goldenDice = Math.min(3, g.goldenDice + b.gdice);
      this.hold = true; SFX.music(null);   // 배경음은 판이 보일 때('go')부터
      window.addEventListener('message', e => {
        const m = e.data || {}; if (m.src !== 'og') return;
        if (m.type === 'go' && this.hold) {
          this.hold = false; this.last = performance.now(); this.acc = 0;
          SFX.music(this.game && this.game.boss ? 'boss' : 'battle');
          // 시작 혜택 알림: 작전 카드 창이 닫힌 뒤에(창 뒤에 깔리지 않게)
          if (o.bonusTxt) { let n = 0; const iv = setInterval(() => { if (++n > 200) clearInterval(iv); if (this.game && !this.ui.modalOpen() && !this.game.cardPick) { clearInterval(iv); this.ui.toast('시작 주사위 ' + o.bonusTxt.d, '더블 혜택!', o.bonusTxt.txt, false, 2.6); } }, 300); }
        }
      });
      requestAnimationFrame(() => requestAnimationFrame(() => this.post({ type: 'ready' })));
    },
    loop(now) {
      const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
      const g = this.game;
      if (g && this.hold) {
        this.renderer.frame(g, 0, this.ui);   // [v5.3] 시안의 진입 연출이 끝날 때까지 판은 멈춘 채 그리기만
      } else if (g) {
        const speed = (this.ui.settings.speed || 1) * (+(Q.get('speed') || 1));
        if (this.net && this.net.ls) {
          // 온라인: 락스텝 — 상대 입력이 도착한 틱까지만 진행(멈춤 · 창과 무관하게 진행)
          const ls = this.net.ls; this.acc = (this.acc || 0) + dt;
          let n = 0;
          while (this.acc >= 1 / 60 && n < 8) { if (!ls.stepOnce(1 / 60, c => NET.applyCmd(g, c))) break; this.acc -= 1 / 60; n++; }
          if (this.acc > 0.5) this.acc = 0.5;
          ls.flush();
          if (ls.desync && !this._desyncShown) { this._desyncShown = true; this.ui.toast('온라인', '두 기기의 판이 어긋났어요', '연결을 끊고 다시 시작해 주세요', true, 4); }
        } else if (!this.paused && !this.ui.modalOpen()) {
          this.acc = (this.acc || 0) + dt * speed;
          let n = 0;
          while (this.acc >= 1 / 60 && n < 12) { g.step(1 / 60); this.acc -= 1 / 60; n++; if (this.bot) this.botTick(1 / 60); }
          if (n >= 12) this.acc = 0;
        }
        const ev = g.events.splice(0);
        this.renderer.consume(g, ev, SFX);
        if (root.HAPTIC) root.HAPTIC.consume(g, ev);
        for (const e of ev) { this.ui.onEvent(e); if (e.ev === 'pity') { try { localStorage.setItem('marble_cardPity', JSON.stringify({ e: e.e, l: e.l })); } catch (x) { /* 저장 안 됨 */ } } }
        if (g.boss && SFX.bgmKind !== 'boss' && !g.over) SFX.music('boss');
        if (!g.boss && SFX.bgmKind === 'boss' && !g.over) SFX.music('battle');
        this.renderer.frame(g, this.paused || this.ui.modalOpen() ? 0 : dt * Math.min(speed, 2), this.ui);
        this.ui.update();
      } else {
        // 로비 뒤 판(움직임 없이)
        const c = this.renderer.ctx; c.drawImage(this.img[(this.ui.choice.mode === 'conquest' && META.CHAPTERS[(this.ui.choice.chapter || 1) - 1].board) || 'board'] || this.img.board, 0, 0, 720, 900);
      }
      requestAnimationFrame(t => this.loop(t));
    },
    botTick(dt) { this.botT = (this.botT || 0) + dt; if (this.botT > 0.25) { this.botT = 0; window.BOT && window.BOT(this.game); } },
    async boot() {
      this.fit(); window.addEventListener('resize', () => this.fit());
      try { await document.fonts.load('700 20px Jua'); await document.fonts.load('400 20px Jua'); } catch (e) { /* 기본 글꼴 */ }
      await this.load();
      this.renderer = new Renderer($('world').getContext('2d'), $('top').getContext('2d'), this.img);
      this.ui = new UI(this);
      this.renderer.showDmg = this.ui.settings.dmg;
      SFX.setOn(this.ui.settings.sound); SFX.setMusic(this.ui.settings.music); if (root.HAPTIC) root.HAPTIC.setOn(this.ui.settings.haptic);
      $('loading').hidden = true;
      const scene = Q.get('scene');
      if (EMBED) this.embedStart();
      else if (scene === 'blank') { /* 시험용: 아무 화면도 열지 않음 */ }
      else if (scene === 'onlineui') { const s2 = document.createElement('script'); s2.src = 'test/qa_online_ui.js'; document.head.appendChild(s2); }
      else if (scene === 'net') { this.ui.lobby(); await new Promise(r => { const s = document.createElement('script'); s.src = 'test/qa_net.js'; s.onload = r; document.head.appendChild(s); }); }
      else if (scene === 'lobbyqa') { const s3 = document.createElement('script'); s3.src = 'test/qa_lobby.js'; document.head.appendChild(s3); }
      else if (scene === 'tree') { this.ui.lobby(); this.ui.tree(Q.get('fam') || 'elem', () => this.ui.lobby()); }
      else if (scene === 'dex') { this.ui.lobby(); await new Promise(r => { const s = document.createElement('script'); s.src = 'test/qa_dex.js'; s.onload = r; document.head.appendChild(s); }); }
      else if (scene === 'ui' || scene === 'strip' || scene === 'gallery' || scene === 'textscan' || scene === 'v42' || scene === 'v44' || scene === 'volley' || scene === 'v45' || scene === 'perf') {
        await new Promise(r => { const s = document.createElement('script'); s.src = 'test/qa_browser.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); });
        this.start({ commander: Q.get('cmd') || 'gambler', pawn: Q.get('pawn') || 'car', mode: 'conquest', deck: Q.get('deck') ? Q.get('deck').split(',') : DATA.DECK });
        if (scene === 'ui') window.QA_UI(); else if (scene === 'textscan') { await new Promise(r => { const s = document.createElement('script'); s.src = 'test/botlogic.js'; s.onload = r; document.head.appendChild(s); }); window.QA_TEXT(); } else if (scene === 'gallery') window.QA_GALLERY(); else if (scene === 'v42') window.QA_V42(Q.get('case') || 'board'); else if (scene === 'v44') window.QA_V44(); else if (scene === 'volley') window.QA_VOLLEY(); else if (scene === 'v45') window.QA_V45(); else if (scene === 'perf') window.QA_PERF(); else window.QA_STRIP(Q.get('what') || 'merge');
      } else if (scene === 'fx47') {   // [v4.7] 알림 · 돈 흐름 연출 확인(test/qa_fx47.js)
        await this.qa('play');
        await new Promise(r => { const s = document.createElement('script'); s.src = 'test/qa_fx47.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); });
        window.QA_FX47(Q.get('what') || 'salary', +(Q.get('at') || 0.6));
      } else if (scene === 'sfxcount') {   // [v4.8] 효과음 호출 수 세기(test/qa_sfxcount.js)
        await this.qa('cards'); this.bot = true;
        await new Promise(r => { const s = document.createElement('script'); s.src = 'test/qa_sfxcount.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); });
        window.QA_SFXCOUNT();
      } else if (Q.get('qa') === 'bot' || scene === 'play' || scene === 'cards' || scene === 'result') {
        await this.qa(scene);
      } else this.ui.lobby();
      requestAnimationFrame(t => this.loop(t));
    },
    // ---------------------------------------------------------- 확인용(헤드리스 캡처)
    async qa(scene) {
      await new Promise(r => { const s = document.createElement('script'); s.src = 'test/botlogic.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); });
      const choice = { commander: Q.get('cmd') || 'gambler', pawn: Q.get('pawn') || 'car', mode: Q.get('mode') || 'conquest', diff: Q.get('diff') || 'normal', chapter: +(Q.get('chapter') || 1), coop: Q.get('coop') === 'human' ? 'human' : Q.get('coop') === '1', deck: Q.get('deck') ? Q.get('deck').split(',') : (Q.get('preset') ? DATA.PRESETS[+Q.get('preset')].deck : DATA.DECK) };
      this.start(choice);
      if (scene === 'cards') return;
      this.bot = Q.get('qa') === 'bot';
      const T = +(Q.get('t') || 0);
      const g = this.game;
      if (T > 0) {
        // 빠르게 감기: 규칙만 돌리고, 마지막 2초는 화면 이펙트까지 함께
        const fast = Math.max(0, T - 2);
        while (g.t < fast && !g.over) { if (g.paused) window.BOT(g); g.step(1 / 60); this.botTick(1 / 60); g.events.length = 0; }
        for (let k = 0; k < 120 && !g.over; k++) { if (g.paused) window.BOT(g); g.step(1 / 60); this.botTick(1 / 60); const ev = g.events.splice(0); this.renderer.consume(g, ev, null); for (const e of ev) this.ui.onEvent(e); this.renderer.frame(g, 1 / 60, this.ui); }
        this.ui.update();
        if (Q.get('hold') !== '0') { this.paused = true; this.bot = false; }
      }
      if (scene === 'result') { g.over = g.over || 'win'; this.qaNoReward = true; this.ui.resultModal(); }
      if (scene === 'tree') { this.ui.tree(Q.get('fam') || 'elem', () => {}); }
    },
  };
  root.App = App;
  App.boot();
})(window);
