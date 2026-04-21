(function(window){
  // Lightweight InputManager: polls Gamepad API, normalizes button/axis events,
  // assigns gamepads to player IDs, and emits both raw and canonical events.
  function InputManager(opts) {
    this.opts = opts || {};
    this.maxPlayers = this.opts.maxPlayers || 2;
    this.deadzone = typeof this.opts.deadzone === 'number' ? this.opts.deadzone : 0.32;
    this.axisInitialDelay = this.opts.axisInitialDelay || 400;
    this.axisRepeatInterval = this.opts.axisRepeatInterval || 120;

    this.handlers = Object.create(null);
    this.running = false;

    // mapping: gamepad.index -> playerId (1-based)
    this.gamepadToPlayer = Object.create(null);
    this.playerToGamepad = Object.create(null);

    // previous button states per gamepad.index
    this.prevButtons = Object.create(null);
    // axis hold state for repeat
    this.prevAxesDir = Object.create(null);

    // Bind native events to track connection lifecycle when available
    window.addEventListener('gamepadconnected', (e) => this._onConnected(e));
    window.addEventListener('gamepaddisconnected', (e) => this._onDisconnected(e));
  }

  InputManager.prototype.on = function(name, fn) {
    (this.handlers[name] = this.handlers[name] || []).push(fn);
  };
  InputManager.prototype.off = function(name, fn) {
    const h = this.handlers[name] || [];
    const idx = h.indexOf(fn);
    if (idx >= 0) h.splice(idx, 1);
  };
  InputManager.prototype._emit = function(name, payload) {
    const h = this.handlers[name] || [];
    for (let i = 0; i < h.length; i++) {
      try { h[i](payload); } catch (err) { console.error('InputManager handler error', err); }
    }
  };

  InputManager.prototype._assignGamepadToPlayer = function(gamepadIndex) {
    if (this.gamepadToPlayer[gamepadIndex]) return this.gamepadToPlayer[gamepadIndex];
    for (let i = 1; i <= this.maxPlayers; i++) {
      if (!this.playerToGamepad[i]) {
        this.gamepadToPlayer[gamepadIndex] = i;
        this.playerToGamepad[i] = gamepadIndex;
        return i;
      }
    }
    return null;
  };

  InputManager.prototype._unassign = function(gamepadIndex) {
    const p = this.gamepadToPlayer[gamepadIndex];
    if (!p) return;
    delete this.gamepadToPlayer[gamepadIndex];
    delete this.playerToGamepad[p];
  };

  InputManager.prototype._onConnected = function(e) {
    const gp = e.gamepad;
    const player = this._assignGamepadToPlayer(gp.index);
    this._emit('gamepadconnected', { gamepadIndex: gp.index, playerId: player, id: gp.id });
  };
  InputManager.prototype._onDisconnected = function(e) {
    const gp = e.gamepad;
    this._unassign(gp.index);
    delete this.prevButtons[gp.index];
    delete this.prevAxesDir[gp.index];
    this._emit('gamepaddisconnected', { gamepadIndex: gp.index });
  };

  InputManager.prototype.start = function() {
    if (this.running) return;
    this.running = true;
    this._loop();
  };
  InputManager.prototype.stop = function() {
    this.running = false;
  };

  InputManager.prototype._loop = function() {
    if (!this.running) return;
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    const now = performance.now();

    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad) continue;
      // ensure assignment
      if (!this.gamepadToPlayer[pad.index]) this._assignGamepadToPlayer(pad.index);
      const playerId = this.gamepadToPlayer[pad.index] || null;

      // buttons
      const prev = this.prevButtons[pad.index] || [];
      for (let b = 0; b < pad.buttons.length; b++) {
        const pressed = !!(pad.buttons[b] && pad.buttons[b].pressed);
        if (pressed && !prev[b]) {
          this._emit('buttondown', { gamepadIndex: pad.index, buttonIndex: b, playerId: playerId });
          // high-level actions
          if (b === 0) this._emit('action', { name: 'confirm', playerId });
          else if (b === 1) this._emit('action', { name: 'cancel', playerId });
          else if (b === 2) this._emit('action', { name: 'secondary', playerId });
          else if (b === 3) this._emit('action', { name: 'join', playerId });
          else if (b === 8) this._emit('action', { name: 'view', playerId });
          else if (b === 9) this._emit('action', { name: 'menu', playerId });
          else if (b >= 12 && b <= 15) {
            const dir = b === 12 ? 'up' : (b === 13 ? 'down' : (b === 14 ? 'left' : 'right'));
            this._emit('navigate', { dir, playerId, buttonIndex: b });
          }
        } else if (!pressed && prev[b]) {
          this._emit('buttonup', { gamepadIndex: pad.index, buttonIndex: b, playerId: playerId });
        }
        prev[b] = pressed;
      }
      this.prevButtons[pad.index] = prev;

      // axes -> emulate D-pad using left stick (axes 0 and 1) with deadzone and repeat
      const ax0 = pad.axes && pad.axes.length > 0 ? pad.axes[0] : 0;
      const ax1 = pad.axes && pad.axes.length > 1 ? pad.axes[1] : 0;
      const dead = this.deadzone;
      let dir = null;
      if (Math.abs(ax0) > Math.abs(ax1)) {
        if (ax0 < -dead) dir = 'left';
        else if (ax0 > dead) dir = 'right';
      } else {
        if (ax1 < -dead) dir = 'up';
        else if (ax1 > dead) dir = 'down';
      }

      const pstate = this.prevAxesDir[pad.index] || { dir: null, nextRepeat: 0 };
      if (dir) {
        if (pstate.dir !== dir) {
          pstate.dir = dir;
          pstate.nextRepeat = now + this.axisInitialDelay;
          this._emit('navigate', { dir, playerId, axis: true });
        } else if (now >= pstate.nextRepeat) {
          pstate.nextRepeat = now + this.axisRepeatInterval;
          this._emit('navigate', { dir, playerId, axis: true });
        }
      } else {
        pstate.dir = null;
        pstate.nextRepeat = 0;
      }
      this.prevAxesDir[pad.index] = pstate;
    }

    requestAnimationFrame(this._loop.bind(this));
  };

  // Expose
  window.InputManager = InputManager;
})(window);
