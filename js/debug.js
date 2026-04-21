(function(window){
  // Debug overlay + automated input test harness
  // Visible when ?debug=true or toggled with backtick (`)

  function DebugPanel() {
    this.panel = null;
    this.input = null;
    this.lastEvent = null;
    this.events = [];
    this.poll = null;
    this.enabled = (new URLSearchParams(location.search).get('debug') === 'true') || localStorage.getItem('hardball_debug') === '1';
    this._init();
  }

  DebugPanel.prototype._init = function() {
    this._makePanel();
    this._attachGlobalToggle();
    this._startPoll();
    this._waitForInput();
  };

  DebugPanel.prototype._makePanel = function() {
    const p = document.createElement('div');
    p.id = 'debug-panel';
    Object.assign(p.style, {
      position: 'fixed',
      right: '8px',
      bottom: '8px',
      width: '360px',
      maxHeight: '60vh',
      overflow: 'auto',
      background: 'rgba(12,12,14,0.88)',
      color: 'white',
      fontSize: '12px',
      fontFamily: 'Arial, Helvetica, sans-serif',
      padding: '10px',
      borderRadius: '8px',
      zIndex: 99999,
      boxShadow: '0 6px 18px rgba(0,0,0,0.6)'
    });

    p.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <strong>Debug</strong>
        <div>
          <button id="debug-toggle-btn" style="margin-right:6px;">${this.enabled ? 'Hide' : 'Show'}</button>
          <button id="debug-run-btn">Run Tests</button>
        </div>
      </div>
      <div id="debug-status" style="color:#cfcfcf; margin-bottom:6px;">Waiting for input subsystem…</div>
      <div id="debug-mapping" style="margin-bottom:8px;"></div>
      <div id="debug-last" style="white-space:pre-wrap; margin-bottom:8px;"></div>
      <div id="debug-results" style="white-space:pre-wrap; font-family:monospace;"></div>
    `;

    document.body.appendChild(p);

    p.querySelector('#debug-toggle-btn').addEventListener('click', () => this.toggle());
    p.querySelector('#debug-run-btn').addEventListener('click', () => this.runTests());

    this.panel = p;
    if (!this.enabled) p.style.display = 'none';
  };

  DebugPanel.prototype._attachGlobalToggle = function() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '`') {
        this.toggle();
      }
    });
  };

  DebugPanel.prototype.toggle = function() {
    this.enabled = !this.enabled;
    localStorage.setItem('hardball_debug', this.enabled ? '1' : '0');
    this.panel.style.display = this.enabled ? 'block' : 'none';
    const btn = this.panel.querySelector('#debug-toggle-btn');
    if (btn) btn.textContent = this.enabled ? 'Hide' : 'Show';
  };

  DebugPanel.prototype._startPoll = function() {
    this.poll = setInterval(() => this._updateUI(), 300);
  };

  DebugPanel.prototype._waitForInput = function() {
    if (window.Input) {
      this.input = window.Input;
      this._hookInput();
      this.panel.querySelector('#debug-status').textContent = 'InputManager available.';
    } else {
      this.panel.querySelector('#debug-status').textContent = 'Waiting for InputManager…';
      setTimeout(() => this._waitForInput(), 300);
    }
  };

  DebugPanel.prototype._hookInput = function() {
    const self = this;
    // subscribe to important events
    this.input.on('buttondown', (p) => { self._pushEvent('buttondown', p); });
    this.input.on('buttonup', (p) => { self._pushEvent('buttonup', p); });
    this.input.on('navigate', (p) => { self._pushEvent('navigate', p); });
    this.input.on('action', (p) => { self._pushEvent('action', p); });
  };

  DebugPanel.prototype._pushEvent = function(type, payload) {
    const ts = new Date().toISOString().substr(11, 8);
    const line = `${ts} ${type} ${JSON.stringify(payload)}`;
    this.lastEvent = line;
    this.events.unshift(line);
    if (this.events.length > 40) this.events.pop();
  };

  DebugPanel.prototype._updateUI = function() {
    // mapping
    const mapEl = this.panel.querySelector('#debug-mapping');
    if (!mapEl) return;
    const lines = [];
    if (this.input) {
      lines.push('Gamepad -> Player mapping:');
      for (const gi in this.input.gamepadToPlayer) {
        if (!Object.prototype.hasOwnProperty.call(this.input.gamepadToPlayer, gi)) continue;
        lines.push(`  gamepad ${gi} -> player ${this.input.gamepadToPlayer[gi]}`);
      }
      if (!Object.keys(this.input.gamepadToPlayer).length) lines.push('  (none)');
      lines.push('Recent events:');
      for (let i = 0; i < Math.min(10, this.events.length); i++) lines.push('  ' + this.events[i]);
    } else {
      lines.push('(InputManager not available)');
    }
    mapEl.textContent = lines.join('\n');

    // last event
    const last = this.panel.querySelector('#debug-last');
    last.textContent = this.lastEvent ? ('Last: ' + this.lastEvent) : 'Last: (none)';
  };

  // --- Test runner ---
  DebugPanel.prototype.runTests = async function() {
    const out = this.panel.querySelector('#debug-results');
    out.textContent = 'Running tests...\n';
    const results = [];

    const savePlayers = state.players.map(p => ({...p}));
    try {
      results.push(await this._testModalReady());
      results.push(await this._testClickMapping());
      results.push(await this._testKeyboardActivation());
      results.push(await this._testGamepadChoice());
    } catch (err) {
      results.push({ name: 'Unexpected error', pass: false, reason: String(err) });
    }

    // restore players exactly
    for (let i = 0; i < state.players.length; i++) {
      Object.assign(state.players[i], savePlayers[i]);
    }

    out.textContent = results.map(r => `${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.reason ? ' — ' + r.reason : ''}`).join('\n');
  };

  DebugPanel.prototype._testModalReady = function() {
    const self = this;
    return new Promise((resolve) => {
      const name = 'Modal readiness via gamepad/button events';
      // Ensure both players are human for the test
      const prevHuman = state.players.map(p => p.isHuman);
      state.players.forEach(p => p.isHuman = true);

      window.__debug_modal_called = false;
      showModal({ title: 'AUTOTEST: modal', requireBothPlayers: true, actions: [ { onclick: () => { window.__debug_modal_called = true; } } ] });

      // Simulate player 1 then player 2 pressing A
      setTimeout(() => { if (window.Input && typeof window.Input._emit === 'function') window.Input._emit('buttondown', { gamepadIndex: 0, buttonIndex: 0, playerId: 1 }); }, 120);
      setTimeout(() => { if (window.Input && typeof window.Input._emit === 'function') window.Input._emit('buttondown', { gamepadIndex: 1, buttonIndex: 0, playerId: 2 }); }, 360);

      const deadline = performance.now() + 2200;
      (function check() {
        if (window.__debug_modal_called) {
          // cleanup
          state.players.forEach((p, i) => p.isHuman = prevHuman[i]);
          resolve({ name, pass: true });
        } else if (performance.now() > deadline) {
          state.players.forEach((p, i) => p.isHuman = prevHuman[i]);
          resolve({ name, pass: false, reason: 'timed out waiting for modal callback' });
        } else setTimeout(check, 120);
      })();
    });
  };

  DebugPanel.prototype._testClickMapping = function() {
    const self = this;
    return new Promise((resolve) => {
      const name = 'Mouse click mapping (left->P1, right->P2)';
      const prevHuman = state.players.map(p => p.isHuman);
      state.players.forEach(p => p.isHuman = true);

      // Create a simple question and render choices
      state.question = { prompt: 'ClickMappingTest', choices: ['A','B','C','D'], answer: 0, difficulty:'easy', category:'Test' };
      renderChoices();
      state.phase = 'question';
      // clear picks
      state.players.forEach(p => p.pickedChoice = null);

      const choice = els.choices.querySelector('.choice[data-index="0"]');
      if (!choice) {
        state.players.forEach((p, i) => p.isHuman = prevHuman[i]);
        return resolve({ name, pass: false, reason: 'choice element not found' });
      }

      const mid = window.innerWidth / 2;
      const leftX = Math.max(10, mid / 2);
      // Dispatch a click on left side
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: leftX });
      choice.dispatchEvent(ev);

      setTimeout(() => {
        const pass = state.players[0].pickedChoice === 0;
        state.players.forEach((p, i) => p.isHuman = prevHuman[i]);
        resolve({ name, pass, reason: pass ? null : `P1 pickedChoice=${state.players[0].pickedChoice}` });
      }, 220);
    });
  };

  DebugPanel.prototype._testKeyboardActivation = function() {
    const self = this;
    return new Promise((resolve) => {
      const name = 'Keyboard Enter activation (single human -> P1)';
      const prevHuman = state.players.map(p => p.isHuman);
      // make only P1 human
      state.players[0].isHuman = true; state.players[1].isHuman = false;

      state.question = { prompt: 'KeyboardTest', choices: ['A','B','C','D'], answer: 0, difficulty:'easy', category:'Test' };
      renderChoices();
      state.phase = 'question';
      state.players.forEach(p => p.pickedChoice = null);

      const choice = els.choices.querySelector('.choice[data-index="1"]');
      if (!choice) { state.players.forEach((p, i) => p.isHuman = prevHuman[i]); return resolve({ name, pass: false, reason: 'choice element not found' }); }
      // Focus and press Enter
      choice.focus();
      const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      choice.dispatchEvent(ev);

      setTimeout(() => {
        const pass = state.players[0].pickedChoice === 1;
        state.players.forEach((p, i) => p.isHuman = prevHuman[i]);
        resolve({ name, pass, reason: pass ? null : `P1 pickedChoice=${state.players[0].pickedChoice}` });
      }, 220);
    });
  };

  DebugPanel.prototype._testGamepadChoice = function() {
    const self = this;
    return new Promise((resolve) => {
      const name = 'Gamepad button->choice mapping';
      const prevHuman = state.players.map(p => p.isHuman);
      state.players.forEach(p => p.isHuman = true);

      state.question = { prompt: 'GamepadTest', choices: ['A','B','C','D'], answer: 0, difficulty:'easy', category:'Test' };
      renderChoices();
      state.phase = 'question';
      state.players.forEach(p => p.pickedChoice = null);

      // Simulate gamepad button 3 (Y) for player 1 maps to choice index 0 per mapping
      if (window.Input && typeof window.Input._emit === 'function') {
        window.Input._emit('buttondown', { gamepadIndex: 0, buttonIndex: 3, playerId: 1 });
      }

      setTimeout(() => {
        const pass = state.players[0].pickedChoice === 0;
        state.players.forEach((p, i) => p.isHuman = prevHuman[i]);
        resolve({ name, pass, reason: pass ? null : `P1 pickedChoice=${state.players[0].pickedChoice}` });
      }, 220);
    });
  };

  // expose
  window.DebugPanel = DebugPanel;

  // Auto-create
  try { window.debugPanel = new DebugPanel(); } catch (err) { console.error('DebugPanel init failed', err); }

})(window);
