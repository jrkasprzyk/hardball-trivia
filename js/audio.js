// ============================================================
// HARDBALL - AudioManager (js/audio.js)
// ============================================================
(function (global) {
  const MUSIC_VOL = 0.6;
  const SFX_VOL   = 0.8;
  const SFX_POOL  = 4;   // concurrent copies per SFX
  const FADE_MS   = 400;

  const MIMES = { ogg: 'audio/ogg; codecs="vorbis"', mp3: 'audio/mpeg' };

  const _probe = new Audio();
  function pickSource(candidates) {
    for (const url of candidates) {
      const ext = url.split('.').pop().toLowerCase();
      if (_probe.canPlayType(MIMES[ext] || '')) return url;
    }
    return candidates[candidates.length - 1]; // fallback to last regardless
  }

  const TRACKS = {
    title:    ['audio/music/title.mp3'],
    gameplay: ['audio/music/gameplay.mp3'],
    endgame:  ['audio/music/endgame.mp3'],
  };
  const SFX_SRCS = {
    click: ['audio/sfx/click.mp3'],
  };

  let _muted = false;
  let _unlocked = false;
  let _pendingTrack = null;  // track name queued before unlock

  // Two music slots for crossfade
  const slots = [new Audio(), new Audio()];
  let activeSlot = 0;
  let fadeInterval = null;

  // SFX pools: { name -> [Audio, ...], next-index }
  const sfxPools = {};
  const sfxCursors = {};

  function _effectiveVol(base) {
    return _muted ? 0 : base;
  }

  function _buildPool(name) {
    if (sfxPools[name]) return;
    const src = pickSource(SFX_SRCS[name]);
    const pool = [];
    for (let i = 0; i < SFX_POOL; i++) {
      const a = new Audio(src);
      a.volume = _effectiveVol(SFX_VOL);
      a.preload = 'auto';
      pool.push(a);
    }
    sfxPools[name] = pool;
    sfxCursors[name] = 0;
  }

  // Build all SFX pools upfront
  function _preloadSFX() {
    for (const name of Object.keys(SFX_SRCS)) _buildPool(name);
  }

  function _unlockAndPlay() {
    if (_unlocked) return;
    _unlocked = true;
    // Resume any pending music after autoplay unlock
    if (_pendingTrack) {
      const t = _pendingTrack;
      _pendingTrack = null;
      _playMusicNow(t);
    }
  }

  function _playMusicNow(trackName, fadeMs) {
    fadeMs = (fadeMs === undefined) ? FADE_MS : fadeMs;
    const src = pickSource(TRACKS[trackName]);
    const incoming = slots[1 - activeSlot];
    const outgoing = slots[activeSlot];

    incoming.src = src;
    incoming.loop = true;
    incoming.volume = 0;
    incoming.currentTime = 0;
    incoming.play().catch(() => {});

    if (fadeInterval) clearInterval(fadeInterval);

    const startVol = outgoing.volume;
    const steps = Math.max(1, Math.round(fadeMs / (1000 / 30)));
    let step = 0;

    fadeInterval = setInterval(() => {
      step++;
      const t = step / steps;
      const curVol = _effectiveVol(MUSIC_VOL);
      outgoing.volume = startVol * (1 - t);
      incoming.volume = curVol * t;
      if (step >= steps) {
        clearInterval(fadeInterval);
        fadeInterval = null;
        outgoing.pause();
        outgoing.src = '';
        incoming.volume = curVol;
        activeSlot = 1 - activeSlot;
      }
    }, 1000 / 30);
  }

  function _applyMuteToAll() {
    const mv = _effectiveVol(MUSIC_VOL);
    const sv = _effectiveVol(SFX_VOL);
    for (const s of slots) s.volume = mv;
    for (const name of Object.keys(sfxPools)) {
      for (const a of sfxPools[name]) a.volume = sv;
    }
    // Update mute icon
    const icon = document.getElementById('audio-mute-toggle');
    if (icon) icon.classList.toggle('muted', _muted);
  }

  // ── Public API ────────────────────────────────────────────
  const HardballAudio = {
    init() {
      _muted = localStorage.getItem('hardball.muted') === 'true';
      _preloadSFX();

      // One-shot autoplay unlock on first user gesture
      const unlock = () => {
        _unlockAndPlay();
        window.removeEventListener('click',   unlock, true);
        window.removeEventListener('keydown', unlock, true);
      };
      window.addEventListener('click',   unlock, true);
      window.addEventListener('keydown', unlock, true);
    },

    playMusic(trackName, opts) {
      const fadeMs = (opts && opts.fadeMs !== undefined) ? opts.fadeMs : FADE_MS;
      if (!_unlocked) {
        _pendingTrack = trackName;
        return;
      }
      _playMusicNow(trackName, fadeMs);
    },

    stopMusic(opts) {
      const fadeMs = (opts && opts.fadeMs !== undefined) ? opts.fadeMs : FADE_MS;
      if (fadeInterval) clearInterval(fadeInterval);
      const outgoing = slots[activeSlot];
      const startVol = outgoing.volume;
      const steps = Math.max(1, Math.round(fadeMs / (1000 / 30)));
      let step = 0;
      fadeInterval = setInterval(() => {
        step++;
        outgoing.volume = startVol * (1 - step / steps);
        if (step >= steps) {
          clearInterval(fadeInterval);
          fadeInterval = null;
          outgoing.pause();
        }
      }, 1000 / 30);
    },

    playSFX(name) {
      if (!sfxPools[name]) return;
      const pool = sfxPools[name];
      const a = pool[sfxCursors[name]];
      sfxCursors[name] = (sfxCursors[name] + 1) % SFX_POOL;
      a.volume = _effectiveVol(SFX_VOL);
      a.currentTime = 0;
      a.play().catch(() => {});
    },

    toggleMute() {
      _muted = !_muted;
      localStorage.setItem('hardball.muted', _muted);
      _applyMuteToAll();
    },

    setMuted(val) {
      _muted = !!val;
      localStorage.setItem('hardball.muted', _muted);
      _applyMuteToAll();
    },

    isMuted() { return _muted; },
  };

  global.HardballAudio = HardballAudio;
})(window);
