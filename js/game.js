// ============================================================
// HARDBALL - game logic (extracted to js/game.js)
// ============================================================

// ---- Question bank (matches promptukit `sections` schema) ----
// Embedded as a last-ditch fallback so the game still runs if both the CDN
// and the local JSON files are unreachable. The live loader below prefers
// the pinned CDN bank, then the local JSONs in this repo.
const EMBEDDED_QUESTION_BANK = {
  "title": "Hardball Default Bank",
  "sections": [
    {
      "title": "General Knowledge",
      "questions": [
        {"prompt": "Which planet has the most moons?", "choices": ["Jupiter", "Saturn", "Uranus", "Neptune"], "answer": 1, "difficulty": "medium"},
        {"prompt": "What is the capital of Australia?", "choices": ["Sydney", "Melbourne", "Canberra", "Perth"], "answer": 2, "difficulty": "easy"},
        {"prompt": "How many bones are in the adult human body?", "choices": ["186", "206", "226", "246"], "answer": 1, "difficulty": "medium"},
        {"prompt": "What is the largest ocean on Earth?", "choices": ["Atlantic", "Indian", "Arctic", "Pacific"], "answer": 3, "difficulty": "easy"},
        {"prompt": "Which element has the chemical symbol 'Au'?", "choices": ["Silver", "Gold", "Aluminum", "Argon"], "answer": 1, "difficulty": "easy"}
      ]
    },
    {
      "title": "Science & Engineering",
      "questions": [
        {"prompt": "What does a Pareto frontier represent?", "choices": ["The worst solutions", "Solutions where no objective can improve without worsening another", "The average of all solutions", "Solutions that satisfy all constraints"], "answer": 1, "difficulty": "hard"},
        {"prompt": "The unit of electrical resistance is the...", "choices": ["Volt", "Watt", "Ohm", "Ampere"], "answer": 2, "difficulty": "easy"},
        {"prompt": "Approximately what percent of Earth's freshwater is in glaciers and ice caps?", "choices": ["10%", "30%", "50%", "68%"], "answer": 3, "difficulty": "hard"},
        {"prompt": "What does 'riparian' refer to?", "choices": ["Desert ecosystems", "Areas along rivers and streams", "Deep ocean zones", "Mountain peaks"], "answer": 1, "difficulty": "medium"},
        {"prompt": "Speed of light in a vacuum (m/s) is closest to...", "choices": ["3 × 10⁸", "3 × 10⁶", "3 × 10¹⁰", "3 × 10⁴"], "answer": 0, "difficulty": "medium"}
      ]
    },
    {
      "title": "Film, TV & Music",
      "questions": [
        {"prompt": "Who directed 'Spirited Away' and 'Ponyo'?", "choices": ["Isao Takahata", "Mamoru Hosoda", "Hayao Miyazaki", "Makoto Shinkai"], "answer": 2, "difficulty": "easy"},
        {"prompt": "Bob Dylan's birth name is...", "choices": ["Robert Allen Zimmerman", "Robert James Dylan", "Robert Thomas Allen", "Robert Alan Wilson"], "answer": 0, "difficulty": "medium"},
        {"prompt": "Which album contains 'Born to Run'?", "choices": ["Nebraska", "Born to Run", "The River", "Darkness on the Edge of Town"], "answer": 1, "difficulty": "easy"},
        {"prompt": "Bad Bunny's summer 2022 album was titled...", "choices": ["YHLQMDLG", "Un Verano Sin Ti", "El Último Tour del Mundo", "X 100pre"], "answer": 1, "difficulty": "medium"},
        {"prompt": "Which band did Bob Mould co-found in the 1980s?", "choices": ["Sugar", "Hüsker Dü", "The Replacements", "Dinosaur Jr."], "answer": 1, "difficulty": "hard"}
      ]
    },
    {
      "title": "Motorsport",
      "questions": [
        {"prompt": "How many laps is the Indianapolis 500?", "choices": ["100", "150", "200", "250"], "answer": 2, "difficulty": "easy"},
        {"prompt": "Modern F1 cars use which engine formula?", "choices": ["1.6L V6 hybrid turbo", "3.0L V10", "2.4L V8", "1.5L I4 turbo"], "answer": 0, "difficulty": "medium"},
        {"prompt": "IndyCar's crown-jewel oval race is held at...", "choices": ["Texas Motor Speedway", "Indianapolis Motor Speedway", "Iowa Speedway", "Gateway"], "answer": 1, "difficulty": "easy"},
        {"prompt": "DRS in Formula 1 stands for...", "choices": ["Dynamic Racing System", "Drag Reduction System", "Downforce Recovery System", "Direct Response Steering"], "answer": 1, "difficulty": "medium"}
      ]
    }
  ]
};

// Question-bank sources, tried in order. First non-empty bank wins; embedded is
// the last-ditch fallback baked into this file.
//
// Pin the CDN to a version tag for real gameplay so content is reproducible.
// Dev (unpinned, tracks main):
//   https://cdn.jsdelivr.net/gh/jrkasprzyk/promptukit@main/promptukit/data/question_banks/jrb_industries_trivia.json
const PROMPTUKIT_VERSION = "v0.2.100";
const CVEN5393_VERSION = "v0.1.4";
const VERSIONS = { PROMPTUKIT_VERSION, CVEN5393_VERSION };
const QUESTION_BANKS = [
  {
    key: "jrb",
    label: "JRB Industries Trivia",
    versionConst: "PROMPTUKIT_VERSION",
    localFallbacks: ["jrb_industries_trivia.v.0.1.281.json", "questions.json"],
    url: `https://cdn.jsdelivr.net/gh/jrkasprzyk/promptukit@${PROMPTUKIT_VERSION}/promptukit/data/question_banks/jrb_industries_trivia.json`
  },
  {
    key: "dev",
    label: "Dev Unaware Challenge",
    versionConst: "PROMPTUKIT_VERSION",
    localFallbacks: [],
    url: `https://cdn.jsdelivr.net/gh/jrkasprzyk/promptukit@${PROMPTUKIT_VERSION}/promptukit/data/question_banks/dev-unaware-challenge.json`
  },
  {
    key: "cven5393",
    label: "CVEN 5393 - SP26 Exam 2 Review",
    versionConst: "CVEN5393_VERSION",
    localFallbacks: [],
    url: `https://cdn.jsdelivr.net/gh/jrkasprzyk/CVEN5393@${CVEN5393_VERSION}/exam_prep/5393.sp26.exam2.review.json`
  }
];
const _bankParam = new URLSearchParams(window.location.search).get("bank");
let selectedBankIndex = Math.max(0, QUESTION_BANKS.findIndex(b => b.key === _bankParam));

// Start with the embedded bank; we'll attempt to load a remote bank below.
let QUESTION_BANK = EMBEDDED_QUESTION_BANK;
let remoteBankReady; // promise that resolves when the remote-bank attempt settles (success or failure)

// ---- Normalize: flatten to a single question pool, promptukit-style tolerant ----
function flattenBank(bank) {
  const pool = [];
  if (Array.isArray(bank.questions)) {
    // Server format: { questions: [...], categories: [...strings] }
    for (const q of bank.questions) {
      pool.push(normalizeQuestion(q, q.category || "Questions"));
    }
  } else if (Array.isArray(bank)) {
    for (const q of bank) pool.push(normalizeQuestion(q, q.category || "Questions"));
  } else {
    // Promptukit sections format: { sections: [{title, questions}] }
    // Only treat bank.categories as sections if its items are objects (not strings)
    const cats = bank.categories;
    const sections = bank.sections || (Array.isArray(cats) && cats[0] && typeof cats[0] === 'object' ? cats : []);
    for (const sec of sections) {
      const title = sec.title || sec.name || sec.label || "Questions";
      for (const q of (sec.questions || [])) {
        pool.push(normalizeQuestion(q, title));
      }
    }
  }
  return pool;
}

function normalizeQuestion(q, category) {
  return {
    prompt: q.prompt || q.q || q.question || q.text || "???",
    choices: q.choices || q.answers || [],
    answer: q.answer ?? q.correct ?? q.correct_index ?? 0,
    difficulty: q.difficulty || "medium",
    quipCorrect: q.quip_correct || q.quipCorrect || null,
    quipWrong: q.quip_wrong || q.quipWrong || null,
    category
  };
}

let POOL = flattenBank(QUESTION_BANK);

// ---- Seeded randomness / sampling without replacement ----
// These variables/backing structures implement sampling-without-replacement
// using a seeded RNG + Fisher-Yates shuffle. We seed from the URL (?seed=123)
// when present, otherwise from `Date.now()` so each session differs.
let RNG_SEED = null;
let RNG = null;
let SHUFFLED_INDICES = null;
let SHUFFLED_CURSOR = 0;
let GAME_POOL = []; // snapshot of POOL at game start; immutable during a session

function prepareShuffledPool(seedOverride) {
  const params = new URLSearchParams(location.search);
  let seedParam = typeof seedOverride !== 'undefined' ? seedOverride : params.get('seed');
  let seed;
  if (seedParam != null) {
    const parsed = Number.parseInt(String(seedParam), 10);
    if (!Number.isFinite(parsed) || isNaN(parsed)) {
      seed = Utils.xfnv1a(String(seedParam));
    } else {
      seed = parsed;
    }
  } else {
    // Use full ms timestamp — >>> 0 would truncate to 32-bit, collapsing many timestamps to the same seed
    seed = Date.now();
  }

  GAME_POOL = POOL.slice(); // snapshot pool so remote-bank loads don't affect this session
  RNG_SEED = seed;
  RNG = Utils.createRng(RNG_SEED);
  SHUFFLED_INDICES = Array.from({ length: GAME_POOL.length }, (_, i) => i);
  Utils.seededShuffle(SHUFFLED_INDICES, RNG);
  SHUFFLED_CURSOR = 0;
  console.log("Prepared shuffled pool — seed:", RNG_SEED, "GAME_POOL.length:", GAME_POOL.length, "SHUFFLED_INDICES.length:", SHUFFLED_INDICES.length, "SHUFFLED_CURSOR:", SHUFFLED_CURSOR);
  if (typeof els !== 'undefined' && els.status) els.status.textContent = `Seed: ${RNG_SEED}`;
}

// ---- Game state ----
const ROUND_TYPES = ["buzz", "simul", "strikes"];
const ROUND_LABELS = { buzz: "BUZZ-IN", simul: "SIMULTANEOUS", strikes: "THREE STRIKES" };

const state = {
  totalRounds: 5,
  round: 0,
  roundType: "buzz",
  question: null,
  players: [
    { id: 1, cash: 0, leverage: 0, strikes: 0, lockedOut: false, pickedChoice: null, answeredCorrect: false, strikesThisRound: 0, isHuman: false },
    { id: 2, cash: 0, leverage: 0, strikes: 0, lockedOut: false, pickedChoice: null, answeredCorrect: false, strikesThisRound: 0, isHuman: false }
  ],
  phase: "idle",     // idle | question | deal | between
  roundQuestions: 0,
  usedQuestions: new Set(),
  roundStart: 0,
  timerTotalMs: 12000,
  timerTimeout: null,
  aiTimers: [],
  firstCorrectPlayer: null,
  briefcaseValue: 0,
  warningTimeout: null,
  tiebreakerPayout: null,  // non-null = tiebreaker question just ran; value = briefcase amount at stake
  tiebreakerPending: false  // set before tiebreaker question so isRoundEnding() fires after it
};

// ---- DOM refs ----
const $ = (id) => document.getElementById(id);
const els = {
  title: $("scene-title"),
  game: $("scene-game"),
  prompt: $("question-prompt"),
  choices: $("choices"),
  roundNum: $("round-num"),
  roundTotal: $("round-total"),
  roundType: $("round-type"),
  sectionTitle: $("section-title"),
  timerFill: $("timer-fill"),
  modal: $("modal-backdrop"),
  modalTitle: $("modal-title"),
  modalSub: $("modal-subtitle"),
  modalDetail: $("modal-detail"),
  modalActions: $("modal-actions"),
  handP1: $("hand-p1"),
  handP2: $("hand-p2"),
  briefcase: $("briefcase"),
  dealBanner: $("deal-banner"),
  dealBannerText: $("deal-banner-text"),
  dealArea: $("deal-area"),
  status: $("status-left"),
  statusRight: $("status-right"),
  panelP1: $("panel-p1"),
  panelP2: $("panel-p2"),
  briefcaseAmount: $("briefcase-amount"),
  quipSplash: $("quip-splash"),
  quipSplashHeader: $("quip-splash-header"),
  quipSplashText: $("quip-splash-text"),
  quoteSplash: $("quote-splash"),
  quoteText: $("quote-text"),
  quoteAttr: $("quote-attr")
};

// Fetch+parse a single bank URL. Returns the parsed object, or throws.
async function fetchBank(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.debug(`Bank ${url} raw snippet:`, rawText.slice(0, 400));
      throw new Error("Invalid JSON from " + url);
    }
    if (!data || typeof data !== 'object') throw new Error("Non-object JSON from " + url);
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Walk the CDN → local-files → embedded chain, stopping at the first source
// that yields a non-empty question pool.
function updateBankButton() {
  const btn = $("btn-bank");
  if (btn) {
    const bank = QUESTION_BANKS[selectedBankIndex];
    btn.textContent = `\u{1F4DA} ${bank.label} (${bank.loadedVersion ?? '\u2026'})`;
  }
  const params = new URLSearchParams(window.location.search);
  params.set("bank", QUESTION_BANKS[selectedBankIndex].key);
  history.replaceState(null, "", `?${params}`);

}

function tryLoadRemoteBank() {
  const bank = QUESTION_BANKS[selectedBankIndex];
  bank.loadedVersion = null;
  updateBankButton();
  const sources = [
    { url: bank.url, kind: 'cdn', label: `cdn ${VERSIONS[bank.versionConst]}` },
    ...bank.localFallbacks.map(url => ({ url, kind: 'local', label: `local ${url}` }))
  ];

  remoteBankReady = (async () => {
    if (els && els.status) els.status.textContent = `Loading question bank…`;
    if (els && els.statusRight) els.statusRight.textContent = `Bank: loading…`;

    for (const src of sources) {
      try {
        const data = await fetchBank(src.url);
        const nextPool = flattenBank(data);
        if (!Array.isArray(nextPool) || nextPool.length === 0) {
          console.warn(`Bank at ${src.url} contained no questions — trying next source.`);
          continue;
        }
        QUESTION_BANK = data;
        POOL = nextPool;
        bank.loadedVersion = src.kind === 'cdn' ? VERSIONS[bank.versionConst] : 'offline copy';
        updateBankButton();
        const title = QUESTION_BANK.title || src.label;
        if (els && els.statusRight) els.statusRight.textContent = `Bank: ${title} (${POOL.length} Qs)`;
        if (els && els.status) els.status.textContent = "Ready.";
        console.log(`Loaded question bank from ${src.kind}:`, src.url);
        // POOL updated; GAME_POOL snapshots on next startGame(). Don't reshuffle mid-session.
        return;
      } catch (err) {
        console.warn(`Question bank source failed (${src.label}):`, err);
      }
    }

    // All remote/local sources failed — keep embedded bank that was loaded at init.
    QUESTION_BANK = EMBEDDED_QUESTION_BANK;
    POOL = flattenBank(QUESTION_BANK);
    bank.loadedVersion = 'built-in';
    updateBankButton();
    if (els && els.statusRight) els.statusRight.textContent = "Bank: embedded (offline)";
    if (els && els.status) els.status.textContent = "Ready.";
  })();
}
tryLoadRemoteBank();

// ============================================================
// SETUP
// ============================================================
$("btn-start").addEventListener("click", startGame);
$("btn-reload-bank").addEventListener("click", tryLoadRemoteBank);
$("btn-bank").addEventListener("click", () => {
  HardballAudio.playSFX("click");
  selectedBankIndex = (selectedBankIndex + 1) % QUESTION_BANKS.length;
  updateBankButton();
  tryLoadRemoteBank();
});
$("btn-rounds-3").addEventListener("click", () => { HardballAudio.playSFX("click"); setRounds(3); });
$("btn-rounds-5").addEventListener("click", () => { HardballAudio.playSFX("click"); setRounds(5); });
$("btn-rounds-7").addEventListener("click", () => { HardballAudio.playSFX("click"); setRounds(7); });
$("btn-help").addEventListener("click", showHelpModal);
const menubarHelp = $("menubar-help");
if (menubarHelp) {
  menubarHelp.addEventListener("click", showHelpModal);
  menubarHelp.addEventListener("keydown", (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showHelpModal(); }
  });
}

// --- Join UI helpers: controller "Y" will mark a gamepad as joined (human)
function updateJoinUI() {
  for (let i = 0; i < 2; i++) {
    const btn = $("join-p" + (i + 1));
    if (!btn) continue;
    if (state.players[i].isHuman) {
      btn.textContent = `P${i + 1}: HUMAN`;
      btn.classList.add('primary');
    } else {
      btn.textContent = `P${i + 1}: CPU (Press Y to join)`;
      btn.classList.remove('primary');
    }
  }
}

function joinPlayer(playerNum) {
  const idx = playerNum - 1;
  if (!state.players[idx]) return;
  if (state.players[idx].isHuman) return; // already joined
  state.players[idx].isHuman = true;
  updateJoinUI();
  if (els.status) els.status.textContent = `Player ${playerNum} joined (controller ${playerNum}).`;
}

// Allow clicking the join buttons to toggle CPU/Human locally
const jb1 = $("join-p1");
if (jb1) jb1.addEventListener('click', () => { state.players[0].isHuman = !state.players[0].isHuman; updateJoinUI(); });
const jb2 = $("join-p2");
if (jb2) jb2.addEventListener('click', () => { state.players[1].isHuman = !state.players[1].isHuman; updateJoinUI(); });

// Initialize join UI (default: CPU if nobody presses Y)
updateJoinUI();

function setRounds(n) {
  state.totalRounds = n;
  $("round-count-label").textContent = `Playing best of ${n} rounds`;
}

async function startGame() {
  // Block until the remote-bank attempt settles so POOL is final before we snapshot it
  if (remoteBankReady) {
    if (els && els.status) els.status.textContent = "Loading question bank…";
    await remoteBankReady;
  }
  state.round = 0;
  // Prepare seeded shuffled pool for this session (seeded from URL or Date.now())
  prepareShuffledPool();
  // Keep usedQuestions cleared for compatibility
  if (state.usedQuestions && state.usedQuestions.clear) state.usedQuestions.clear();
  for (const p of state.players) {
    p.cash = 0; p.leverage = 0; p.strikes = 0; p.lockedOut = false;
  }
  state.tiebreakerPayout = null;
  state.tiebreakerPending = false;
  updateHUD();
  showScene("game");
  HardballAudio.playMusic("gameplay");
  nextRound();
}

function showScene(name) {
  document.querySelectorAll(".scene").forEach(s => s.classList.remove("active"));
  $("scene-" + name).classList.add("active");
  if (name === "title") {
    titleFocus = titleFocus || 0;
    updateTitleFocus();
  } else {
    document.querySelectorAll('.luna-btn.focused').forEach(b => b.classList.remove('focused'));
  }
}

// ============================================================
// ROUND FLOW
// ============================================================

// Leverage is a per-player progress meter: advance your hand to the briefcase
// (WIN) to win the round, or get pushed to the back wall (PIN) and lose it.
// HARD_CAP is a safety net so rounds can't stall forever.
const LEVERAGE_WIN = 100;
const LEVERAGE_PIN = -60;
const ROUND_HARD_CAP = 15;

// Briefcase values escalate Family-Feud-style: round N = N × BASE,
// with the final round doubled to keep late-game comebacks meaningful.
const BRIEFCASE_BASE = 200;
function briefcaseValueFor(round, totalRounds) {
  if (round === totalRounds) return totalRounds * BRIEFCASE_BASE * 2;
  return round * BRIEFCASE_BASE;
}

// Hand position as a CSS length (used for `left` on P1, `right` on P2).
// 0 leverage → 2% (near own edge); +WIN → just short of the briefcase center
// (calc() keeps the fingertip clear of the briefcase on any window size);
// -PIN → recoiled past the edge.
// Hand element is 120px wide with fingertips near its leading edge; the
// briefcase is 90px wide centered at 50%, so a 160px offset from center
// lands the fingertip just before the briefcase edge on any screen.
function handPositionStyle(leverage) {
  if (leverage >= 0) {
    const frac = Math.min(1, leverage / LEVERAGE_WIN);
    // Interpolate (2%, 0px) → (50%, 160px) so at frac=1 we land at calc(50% - 160px)
    const pct = 2 + frac * 48;
    const px = frac * 160;
    return `calc(${pct}% - ${px}px)`;
  }
  const frac = Math.max(-1, leverage / Math.abs(LEVERAGE_PIN));
  return (2 + frac * 12) + '%';
}

function nextRound() {
  if (state.round >= state.totalRounds) {
    return endGame();
  }
  state.round++;
  state.roundType = ROUND_TYPES[(state.round - 1) % ROUND_TYPES.length];
  state.briefcaseValue = briefcaseValueFor(state.round, state.totalRounds);
  state.roundQuestions = 1;
  // Pick a question not yet used (sampling without replacement via shuffled indices)
  let q = randomQuestion();
  if (!q) {
    console.error('nextRound: randomQuestion returned undefined', { GAME_POOL_length: GAME_POOL.length, SHUFFLED_length: (Array.isArray(SHUFFLED_INDICES) ? SHUFFLED_INDICES.length : 0), SHUFFLED_CURSOR });
    q = { prompt: 'No question available', choices: ['OK'], answer: 0, difficulty: 'easy', category: 'System' };
  }
  state.question = q;
  // Reset per-round player state
  for (const p of state.players) {
    p.leverage = 0;
    p.pickedChoice = null;
    p.answeredCorrect = false;
    p.lockedOut = false;
    p.strikesThisRound = 0;
  }
  state.firstCorrectPlayer = null;
  $("locked-p1")?.classList.remove("shown");
  $("locked-p2")?.classList.remove("shown");

  // Update UI labels
  els.roundNum.textContent = state.round;
  els.roundTotal.textContent = state.totalRounds;
  els.roundType.textContent = roundTypeLabel();
  els.sectionTitle.textContent = q.category;
  updateHUD();
  resetDealScene();

  showQuoteSplash(pickRandomQuote(), () => {
    showModal({
      title: "ROUND " + state.round,
      subtitle: ROUND_LABELS[state.roundType] + "  —  BRIEFCASE: $" + state.briefcaseValue,
      detail: roundTypeBlurb(state.roundType),
      requireBothPlayers: true,
      actions: [{ onclick: () => { beginQuestion(); } }]
    });
  });
}

function roundTypeLabel() {
  return `${ROUND_LABELS[state.roundType]} (Q${state.roundQuestions})`;
}

function roundTypeBlurb(t) {
  const tail = " Advance your hand to the briefcase (+100 leverage) to take the round, or get pinned at -60 and your opponent wins.";
  if (t === "buzz") return "First correct answer earns leverage. Wrong buzz locks you out and drops leverage." + tail;
  if (t === "simul") return "Lock in your answer secretly. Both reveal together. Correct answers gain leverage; wrong or missing picks lose it." + tail;
  if (t === "strikes") return "Rapid-fire questions — wrong answers add strikes AND drop leverage. Correct answers remove a strike and gain leverage. Three strikes ends the round immediately." + tail;
  return "";
}

function randomQuestion() {
  if (!Array.isArray(GAME_POOL) || GAME_POOL.length === 0) {
    console.error("Question pool is empty — falling back to embedded bank.");
    QUESTION_BANK = EMBEDDED_QUESTION_BANK;
    POOL = flattenBank(QUESTION_BANK);
    prepareShuffledPool();
    if (!Array.isArray(GAME_POOL) || GAME_POOL.length === 0) {
      return { prompt: 'No questions available', choices: ['OK'], answer: 0, difficulty: 'easy', category: 'System' };
    }
  }
  // Reshuffle only when all questions have been drawn (sampling without replacement cycles)
  if (!SHUFFLED_INDICES || SHUFFLED_CURSOR >= SHUFFLED_INDICES.length) {
    const newSeed = (RNG_SEED + Date.now()) >>> 0;
    RNG_SEED = newSeed;
    RNG = Utils.createRng(RNG_SEED);
    SHUFFLED_INDICES = Array.from({ length: GAME_POOL.length }, (_, i) => i);
    Utils.seededShuffle(SHUFFLED_INDICES, RNG);
    SHUFFLED_CURSOR = 0;
  }
  const idx = SHUFFLED_INDICES[SHUFFLED_CURSOR++];
  return GAME_POOL[idx];
}

function beginQuestion() {
  state.phase = "question";
  renderChoices();
  els.prompt.textContent = state.question.prompt;
  startTimer(state.timerTotalMs);
  // Schedule AI actions for CPU-controlled players (if any)
  scheduleAIForQuestion();
  els.status.textContent = "Phase: answering...";
}

function renderChoices() {
  els.choices.innerHTML = "";
  // Display letters that match Xbox face layout: Y (top), X (left), B (right), A (bottom)
  const displayLetters = ["Y", "X", "B", "A"];
  const posClass = ["pos-y", "pos-x", "pos-b", "pos-a"];
  state.question.choices.forEach((ch, i) => {
    const div = document.createElement("div");
    div.className = "choice";
    div.classList.add(posClass[i] || "");
    div.dataset.index = i;
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', `${displayLetters[i] || ''}: ${ch}`);
    div.innerHTML = `
        <div class="letter">${displayLetters[i] || ''}</div>
        <div class="text">${escapeHTML(ch)}</div>
        <div class="press-indicators">
          <div class="press-dot p1" data-player="1"></div>
          <div class="press-dot p2" data-player="2"></div>
        </div>
      `;
    // Make choices keyboard-focusable and handle activation via pointer or keyboard.
    div.setAttribute('tabindex', '0');
    div.addEventListener('click', (ev) => {
      const player = getPlayerFromActivationEvent(ev);
      handlePlayerInput(player, i);
    });
    div.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        const player = getPlayerFromActivationEvent(ev);
        handlePlayerInput(player, i);
      }
    });
    els.choices.appendChild(div);
  });
}

function escapeHTML(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// Determine which player a local activation (mouse click or keyboard Enter)
// should be attributed to.
function getPlayerFromActivationEvent(e) {
  // If exactly one human player is present, attribute to them.
  const humans = state.players.map((p, i) => p.isHuman ? i + 1 : null).filter(Boolean);
  if (humans.length === 1) return humans[0];

  // If event carries a clientX (pointer), use screen side: left = P1, right = P2.
  if (e && typeof e.clientX === 'number') {
    try {
      const mid = window.innerWidth / 2;
      return (e.clientX < mid) ? 1 : 2;
    } catch (err) {
      // fall through
    }
  }

  // Default fallback to player 1.
  return 1;
}

// ============================================================
// TIMER
// ============================================================
function startTimer(ms) {
  if (state.warningTimeout) { clearTimeout(state.warningTimeout); state.warningTimeout = null; }
  state.roundStart = performance.now();
  els.timerFill.style.transition = "none";
  els.timerFill.style.width = "100%";
  els.timerFill.classList.remove("warning");
  // Force reflow
  void els.timerFill.offsetWidth;
  els.timerFill.style.transition = `width ${ms}ms linear`;
  els.timerFill.style.width = "0%";

  clearTimeout(state.timerTimeout);
  state.timerTimeout = setTimeout(() => onTimeUp(), ms);

  state.warningTimeout = setTimeout(() => {
    state.warningTimeout = null;
    els.timerFill.classList.add("warning");
  }, ms * 0.75);
}

function stopTimer() {
  clearTimeout(state.timerTimeout);
  if (state.warningTimeout) { clearTimeout(state.warningTimeout); state.warningTimeout = null; }
  // Clear any scheduled AI timeouts for this question
  if (state.aiTimers && state.aiTimers.length) {
    state.aiTimers.forEach(t => clearTimeout(t));
    state.aiTimers = [];
  }
  // Freeze the bar where it is by computing the current width
  const rect = els.timerFill.getBoundingClientRect();
  const parentRect = els.timerFill.parentElement.getBoundingClientRect();
  const currentPct = (rect.width / parentRect.width) * 100;
  els.timerFill.style.transition = "none";
  els.timerFill.style.width = currentPct + "%";
}

// ============================================================
// SIMPLE AI OPPONENT (runs when a player slot is not marked human)
// ============================================================
function scheduleAIForQuestion() {
  // Clear any previous AI timers
  state.aiTimers = state.aiTimers || [];
  state.aiTimers.forEach(t => clearTimeout(t));
  state.aiTimers = [];
  if (state.phase !== 'question') return;
  const q = state.question;
  if (!q) return;

  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    const playerNum = i + 1;
    if (p.isHuman) continue; // humans supply their own input

    const difficulty = (q.difficulty || 'medium').toLowerCase();
    let baseAcc = difficulty === 'easy' ? 0.8 : (difficulty === 'hard' ? 0.4 : 0.6);
    if (state.roundType === 'strikes') {
      if (p.strikes >= 2) baseAcc = Math.min(0.95, baseAcc + 0.15);
    }
    baseAcc = Math.max(0.05, Math.min(0.95, baseAcc));

    const willBeCorrect = Math.random() < baseAcc;
    let chosenIdx;
    if (willBeCorrect) chosenIdx = q.answer;
    else {
      const wrong = [];
      for (let j = 0; j < q.choices.length; j++) if (j !== q.answer) wrong.push(j);
      chosenIdx = wrong[Math.floor(Math.random() * wrong.length)];
    }

    let rt;
    if (state.roundType === 'buzz') {
      rt = 900 + Math.random() * 1400 * (1 - baseAcc * 0.4);
    } else {
      const max = Math.max(300, state.timerTotalMs - 400);
      rt = 300 + Math.random() * Math.max(0, max - 300);
    }

    const tid = setTimeout(() => {
      if (state.phase !== 'question') return;
      if (state.players[i].lockedOut || state.players[i].isHuman) return;
      handlePlayerInput(playerNum, chosenIdx);
    }, rt);
    state.aiTimers.push(tid);
  }
}

function onTimeUp() {
  if (state.phase !== "question") return;
  // Resolve based on round type
  resolveQuestion();
}

// ============================================================
// INPUT (keyboard + gamepad)
// ============================================================
// P1: 1/2/3/4 -> indices 0-3
// P2: 7/8/9/0 -> indices 0-3
const KEY_MAP = {
  "1": { player: 1, idx: 0 }, "2": { player: 1, idx: 1 },
  "3": { player: 1, idx: 2 }, "4": { player: 1, idx: 3 },
  "7": { player: 2, idx: 0 }, "8": { player: 2, idx: 1 },
  "9": { player: 2, idx: 2 }, "0": { player: 2, idx: 3 }
};

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  let m = KEY_MAP[e.key];
  // Fallback to the physical key code for cases where Shift/modifiers change e.key
  if (!m && e.code) {
    const codeKey = String(e.code).replace(/^Digit|^Numpad/, '');
    m = KEY_MAP[codeKey];
  }
  if (m && modalReadyCallback && els.modal && els.modal.classList.contains('active')) {
    if (state.players[m.player - 1] && state.players[m.player - 1].isHuman) {
      markModalReady(m.player - 1);
    }
  }
  if (m && state.phase === "question") {
    if (state.players[m.player - 1] && state.players[m.player - 1].isHuman) {
      handlePlayerInput(m.player, m.idx);
    }
  }
  if (e.key === "Escape" && state.phase !== "idle") {
    returnToTitle();
  }
  if (e.key === "m" || e.key === "M") {
    HardballAudio.toggleMute();
  }
});

function returnToTitle() {
  hideModal();
  showScene("title");
  state.phase = "idle";
  HardballAudio.playMusic("title");
}

const btnCloseWindow = $("btn-close-window");
if (btnCloseWindow) {
  btnCloseWindow.addEventListener("click", returnToTitle);
  btnCloseWindow.addEventListener("keydown", (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); returnToTitle(); }
  });
}

const btnMute = $("audio-mute-toggle");
if (btnMute) {
  btnMute.addEventListener("click", () => HardballAudio.toggleMute());
  btnMute.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); HardballAudio.toggleMute(); }
  });
}

// Gamepad handling with explicit Xbox layout mapping and title navigation
// Xbox gamepad standard mapping: 0=A, 1=B, 2=X, 3=Y
// We remap so that controller face buttons map to choice positions:
// button 3 (Y) -> choice 0 (top), 2 (X) -> choice 1 (left), 1 (B) -> choice 2 (right), 0 (A) -> choice 3 (bottom)
const GAMEPAD_BUTTON_TO_CHOICE = [3, 2, 1, 0]; // gamepad button idx -> choice idx
const gamepadPrev = {};

// Title screen navigation elements
const TITLE_NAV_ELEMENTS = [ $("btn-start"), $("btn-rounds-3"), $("btn-rounds-5"), $("btn-rounds-7"), $("btn-help"), $("btn-reload-bank"), $("btn-bank") ];
let titleFocus = 0;
function updateTitleFocus() {
  TITLE_NAV_ELEMENTS.forEach((el, i) => {
    if (!el) return;
    el.classList.toggle('focused', i === titleFocus);
  });
}
function handleTitleGamepadInput(player, buttonIndex) {
  // D-pad: 12=up, 13=down, 14=left, 15=right; A (0) = confirm
  if (buttonIndex === 12 || buttonIndex === 14) {
    titleFocus = (titleFocus - 1 + TITLE_NAV_ELEMENTS.length) % TITLE_NAV_ELEMENTS.length;
    updateTitleFocus();
  } else if (buttonIndex === 13 || buttonIndex === 15) {
    titleFocus = (titleFocus + 1) % TITLE_NAV_ELEMENTS.length;
    updateTitleFocus();
  } else if (buttonIndex === 0) {
    const el = TITLE_NAV_ELEMENTS[titleFocus];
    if (el) el.click();
  }
}

// Modal focus for controller confirmation
let modalFocus = 0;
function updateModalFocus() {
  if (!els.modalActions) return;
  const btns = els.modalActions.querySelectorAll('button');
  btns.forEach((b, i) => b.classList.toggle('focused', i === modalFocus));
}

function pollGamepads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let p = 0; p < Math.min(2, pads.length); p++) {
    const pad = pads[p];
    if (!pad) continue;
    const player = p + 1;
    const prev = gamepadPrev[player] || (gamepadPrev[player] = []);

    // Face buttons 0..3 (A,B,X,Y)
    for (const b of [0,1,2,3]) {
      const pressed = pad.buttons[b] && pad.buttons[b].pressed;
      if (pressed && !prev[b]) {
        // Modal gets priority when active
        if (els.modal && els.modal.classList.contains('active')) {
          if (b === 0) {
            if (modalReadyCallback) {
              if (state.players[player - 1] && state.players[player - 1].isHuman) {
                markModalReady(player - 1);
              }
            } else {
              const btns = els.modalActions.querySelectorAll('button');
              const btn = btns[modalFocus] || btns[0];
              if (btn) btn.click();
            }
          }
        } else if (document.querySelector("#scene-title").classList.contains("active")) {
            // On the title screen: pressing Y (button 3) joins that controller's player slot
            if (b === 3 && !state.players[player - 1].isHuman) {
              joinPlayer(player);
            } else {
              handleTitleGamepadInput(player, b);
            }
        } else if (state.phase === "question") {
          // Only accept gamepad input if this player slot is human
          if (state.players[player - 1] && state.players[player - 1].isHuman) {
            const choiceIdx = GAMEPAD_BUTTON_TO_CHOICE[b];
            handlePlayerInput(player, choiceIdx);
          }
        }
      }
      prev[b] = !!pressed;
    }

    // D-pad (12=up,13=down,14=left,15=right) for title/modal navigation
    for (const b of [12,13,14,15]) {
      const pressed = pad.buttons[b] && pad.buttons[b].pressed;
      if (pressed && !prev[b]) {
        if (els.modal && els.modal.classList.contains('active')) {
          const btns = els.modalActions ? els.modalActions.children : null;
          if (btns && btns.length) {
            if (b === 12 || b === 14) {
              modalFocus = (modalFocus - 1 + btns.length) % btns.length;
              updateModalFocus();
            } else if (b === 13 || b === 15) {
              modalFocus = (modalFocus + 1) % btns.length;
              updateModalFocus();
            }
          }
        } else if (document.querySelector("#scene-title").classList.contains("active")) {
          handleTitleGamepadInput(player, b);
        }
      }
      prev[b] = !!pressed;
    }

    // System buttons: 8=View (return to title), 9=Menu (mute) — only player 1 to avoid double-fire
    if (p === 0) {
      for (const b of [8, 9]) {
        const pressed = pad.buttons[b] && pad.buttons[b].pressed;
        if (pressed && !prev[b]) {
          if (b === 9) HardballAudio.toggleMute();
          if (b === 8 && state.phase !== "idle") returnToTitle();
        }
        prev[b] = !!pressed;
      }
    }
  }
  requestAnimationFrame(pollGamepads);
}
// Initialize title focus if title is visible
if (document.querySelector("#scene-title").classList.contains("active")) updateTitleFocus();
// Start unified InputManager (handles gamepad polling + canonical actions)
if (window.InputManager) {
  window.Input = new InputManager({ maxPlayers: 2, deadzone: 0.28, axisInitialDelay: 350, axisRepeatInterval: 120 });

  // Raw button handling — mirrors previous pollGamepads behavior but via events
  Input.on('buttondown', ({ gamepadIndex, buttonIndex, playerId }) => {
    const player = playerId || (gamepadIndex + 1);
    // Extra debug logging to help trace why some gamepad inputs fail to map
    try {
      const dbg = localStorage.getItem('hardball_debug') === '1';
      if (dbg) console.debug('[Input debug] buttondown', { gamepadIndex, buttonIndex, playerId, player, phase: state.phase, isHuman: state.players[player - 1] && state.players[player - 1].isHuman, lockedOut: state.players[player - 1] && state.players[player - 1].lockedOut });
    } catch (err) { /* ignore */ }
    // Modal gets priority when active
    if (els.modal && els.modal.classList.contains('active')) {
      if (buttonIndex === 0) {
        if (modalReadyCallback) {
          if (state.players[player - 1] && state.players[player - 1].isHuman) {
            markModalReady(player - 1);
          }
        } else {
          const btns = els.modalActions.querySelectorAll('button');
          const btn = btns[modalFocus] || btns[0];
          if (btn) btn.click();
        }
      }
      return;
    }

    // Title screen navigation / join
    if (document.querySelector("#scene-title").classList.contains("active")) {
      if (buttonIndex === 3 && !state.players[player - 1].isHuman) {
        joinPlayer(player);
      } else {
        handleTitleGamepadInput(player, buttonIndex);
      }
      return;
    }

    // In-question choices
    if (state.phase === "question") {
      const playerObj = state.players[player - 1];
      if (playerObj && playerObj.isHuman) {
        const choiceIdx = GAMEPAD_BUTTON_TO_CHOICE[buttonIndex];
        try {
          const dbg = localStorage.getItem('hardball_debug') === '1';
          if (dbg) console.debug('[Input debug] computed choiceIdx', { buttonIndex, choiceIdx, player });
        } catch (err) {}
        if (typeof choiceIdx !== 'undefined') {
          // Only call if not locked out and valid choice
          if (!playerObj.lockedOut) handlePlayerInput(player, choiceIdx);
          else {
            try { if (localStorage.getItem('hardball_debug') === '1') console.debug('[Input debug] player locked out, ignoring input', player); } catch (e) {}
          }
        }
      } else {
        try { if (localStorage.getItem('hardball_debug') === '1') console.debug('[Input debug] ignoring buttondown: not human or missing player', player); } catch (e) {}
      }
    }
  });

  // System-level buttons (only act for player 1 to avoid double-fire)
  Input.on('buttondown', ({ buttonIndex, playerId }) => {
    if (playerId === 1) {
      if (buttonIndex === 9) HardballAudio.toggleMute();
      if (buttonIndex === 8 && state.phase !== "idle") returnToTitle();
    }
  });

  // D-pad / axis navigation for modals and title
  Input.on('navigate', ({ dir, playerId }) => {
    if (els.modal && els.modal.classList.contains('active')) {
      const btns = els.modalActions ? els.modalActions.children : null;
      if (btns && btns.length) {
        if (dir === 'up' || dir === 'left') {
          modalFocus = (modalFocus - 1 + btns.length) % btns.length;
          updateModalFocus();
        } else if (dir === 'down' || dir === 'right') {
          modalFocus = (modalFocus + 1) % btns.length;
          updateModalFocus();
        }
      }
    } else if (document.querySelector("#scene-title").classList.contains("active")) {
      const map = { up: 12, down: 13, left: 14, right: 15 };
      handleTitleGamepadInput(playerId, map[dir]);
    }
  });

  Input.start();
} else {
  // Fallback to legacy poll loop if InputManager isn't available
  requestAnimationFrame(pollGamepads);
}

function handlePlayerInput(playerNum, choiceIdx) {
  // Only accept input while a question is actively live. Blocks late buzzes
  // after someone else has already locked it in (phase === "resolving") and
  // stray input during the pre-question reading window (phase === "deal").
  if (state.phase !== "question") return;
  if (choiceIdx >= state.question.choices.length) return;
  const p = state.players[playerNum - 1];
  if (p.lockedOut) return;

  HardballAudio.playSFX("click");

  // Round-type-specific input handling
  if (state.roundType === "buzz") {
    // first correct answer takes it all; wrong answer locks you out
    if (p.pickedChoice !== null) return; // one shot
    p.pickedChoice = choiceIdx;
    markPress(playerNum, choiceIdx);
    const correct = choiceIdx === state.question.answer;
    if (correct) {
      state.firstCorrectPlayer = playerNum;
      p.answeredCorrect = true;
      stopTimer();
      state.phase = "resolving"; // block further input immediately
      setTimeout(() => resolveQuestion(), 300);
    } else {
      // Wrong buzz = lockout for this question
      p.lockedOut = true;
      flashChoice(choiceIdx, "incorrect");
      // Other player still has a chance
      checkBothLockedOrAnswered();
    }
  } else if (state.roundType === "simul") {
    // Can change pick until time runs out; keep picks secret until reveal
    p.pickedChoice = choiceIdx;
    // Do NOT show press indicators here so picks remain hidden during simultaneous lock-in.
    const badge = $("locked-p" + playerNum);
    if (badge) badge.classList.add("shown");
    // If both players have locked in, speed up to reveal both at the same time.
    if (state.players[0].pickedChoice !== null && state.players[1].pickedChoice !== null) {
      stopTimer();
      state.phase = "resolving";
      setTimeout(() => resolveQuestion(), 500);
    }
  } else if (state.roundType === "strikes") {
    // Each wrong answer is a strike (this round). Right answer reverses opponent's strike (if any).
    if (p.pickedChoice === choiceIdx) return; // avoid spam on same choice
    p.pickedChoice = choiceIdx;
    markPress(playerNum, choiceIdx);
    const correct = choiceIdx === state.question.answer;
    if (correct) {
      p.answeredCorrect = true;
      stopTimer();
      state.phase = "resolving";
      setTimeout(() => resolveQuestion(), 400);
    } else {
      p.strikesThisRound++;
      flashChoice(choiceIdx, "incorrect");
      // Total strikes including this round
      const totalStrikes = p.strikes + p.strikesThisRound;
      if (totalStrikes >= 3) {
        p.lockedOut = true;
      }
      updateHUD();
      // Reset pick so they can try again (if not locked out)
      setTimeout(() => { p.pickedChoice = null; clearPress(playerNum); }, 400);
      checkBothLockedOrAnswered();
    }
  }
}

function checkBothLockedOrAnswered() {
  const both = state.players.every(p => p.lockedOut || p.answeredCorrect);
  if (both && state.phase === "question") {
    stopTimer();
    state.phase = "resolving";
    setTimeout(() => resolveQuestion(), 400);
  }
}

function markPress(playerNum, idx) {
  clearPress(playerNum);
  const choice = els.choices.children[idx];
  if (!choice) return;
  const dot = choice.querySelector(`.press-dot.p${playerNum}`);
  if (dot) dot.classList.add("shown");
}
function clearPress(playerNum) {
  document.querySelectorAll(`.press-dot.p${playerNum}`).forEach(d => d.classList.remove("shown"));
}
function updateAllPressIndicators() {
  clearPress(1); clearPress(2);
  for (const p of state.players) {
    if (p.pickedChoice !== null) markPress(p.id, p.pickedChoice);
  }
}
function flashChoice(idx, cls) {
  const el = els.choices.children[idx];
  if (!el) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 600);
}

// ============================================================
// RESOLUTION
// ============================================================
function resolveQuestion() {
  if (state.phase !== "question" && state.phase !== "resolving") return;
  state.phase = "deal";
  stopTimer();

  const correct = state.question.answer;
  // Show the correct answer
  for (let i = 0; i < els.choices.children.length; i++) {
    els.choices.children[i].classList.remove("incorrect");
  }
  els.choices.children[correct].classList.add("correct");

  // Reveal any secret picks (simultaneous rounds) by showing press indicators now
  if (state.roundType === "simul") {
    updateAllPressIndicators();
    $("locked-p1")?.classList.remove("shown");
    $("locked-p2")?.classList.remove("shown");
  }

  // Compute leverage per round type. Values are tuned so a dominant player
  // reaches LEVERAGE_WIN (+100) in ~4 questions; trading blows takes longer.
  if (state.roundType === "buzz") {
    if (state.firstCorrectPlayer) {
      state.players[state.firstCorrectPlayer - 1].leverage += 30;
    }
    for (const p of state.players) {
      if (p.lockedOut && !p.answeredCorrect) p.leverage -= 18;
    }
  } else if (state.roundType === "simul") {
    for (const p of state.players) {
      if (p.pickedChoice === correct) {
        p.answeredCorrect = true;
        p.leverage += 25;
      } else if (p.pickedChoice === null) {
        p.leverage -= 15;
      } else {
        p.leverage -= 10;
      }
    }
  } else if (state.roundType === "strikes") {
    // Commit strikesThisRound to total
    for (const p of state.players) {
      p.strikes = Math.min(3, p.strikes + p.strikesThisRound);
    }
    for (let i = 0; i < 2; i++) {
      const p = state.players[i];
      if (p.answeredCorrect) {
        p.leverage += 28;
        if (p.strikes > 0) p.strikes--;
      } else if (p.lockedOut) {
        p.leverage -= 20;
      } else {
        p.leverage -= 6;
      }
    }
  }

  updateHUD();
  updateDealPositions(false);

  if (isRoundEnding()) {
    els.status.textContent = "Phase: negotiating...";
    setTimeout(() => runDealPhase(), 900);
  } else {
    els.status.textContent = "Next question...";
    const quip = pickInterstitialQuip();
    if (quip) {
      setTimeout(() => {
        showQuipSplash(quip.header, quip.text, quip.duration || 2000, () => startNextQuestionSameRound());
      }, 700);
    } else {
      setTimeout(() => startNextQuestionSameRound(), 1500);
    }
  }
}

// Generic interstitial quips, bucketed by outcome. We always surface one
// (unless the round is actually ending) — the job here is to grow tension
// between questions and make every answer feel like it landed.
const GENERIC_QUIPS = {
  p1Correct: [
    { header: "P1 PRESSES", text: "One step closer to the briefcase." },
    { header: "GROUND GAINED", text: "P1's hand doesn't stop moving." },
    { header: "P1 HOLDS THE LINE", text: "Eyes locked. Hand forward." },
    { header: "P1 LEANS IN", text: "The table just got shorter." }
  ],
  p2Correct: [
    { header: "P2 PRESSES", text: "One step closer to the briefcase." },
    { header: "GROUND GAINED", text: "P2's hand doesn't stop moving." },
    { header: "P2 HOLDS THE LINE", text: "Eyes locked. Hand forward." },
    { header: "P2 LEANS IN", text: "The table just got shorter." }
  ],
  bothCorrect: [
    { header: "NECK AND NECK", text: "Nobody flinches. The deal tightens." },
    { header: "BOTH SHARP", text: "Two hands reaching. One briefcase." },
    { header: "EVEN FOOTING", text: "Nobody gives an inch." }
  ],
  bothWrong: [
    { header: "NOBODY'S BUYING", text: "The briefcase stays shut." },
    { header: "A SLOW SPIN", text: "Both hands pull back. Try again." },
    { header: "MISCALCULATED", text: "The room just got quieter." }
  ],
  p1NearWin: [
    { header: "P1 REACHES FOR IT", text: "Fingertips away from the handle." },
    { header: "CLOSE ENOUGH TO SMELL IT", text: "P1 can see their reflection in the latch." }
  ],
  p2NearWin: [
    { header: "P2 REACHES FOR IT", text: "Fingertips away from the handle." },
    { header: "CLOSE ENOUGH TO SMELL IT", text: "P2 can see their reflection in the latch." }
  ],
  p1NearPin: [
    { header: "P1 AGAINST THE WALL", text: "One more wrong move and it's over." },
    { header: "P1 ON THE ROPES", text: "The room tilts. Not in their favor." }
  ],
  p2NearPin: [
    { header: "P2 AGAINST THE WALL", text: "One more wrong move and it's over." },
    { header: "P2 ON THE ROPES", text: "The room tilts. Not in their favor." }
  ]
};

function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickInterstitialQuip() {
  const q = state.question;
  const p1 = state.players[0];
  const p2 = state.players[1];
  const p1c = p1.answeredCorrect;
  const p2c = p2.answeredCorrect;

  // Tension quips: someone's close to the briefcase or close to being pinned.
  // Half the time these trump the regular outcome quip.
  if (Math.random() < 0.5) {
    if (p1.leverage >= LEVERAGE_WIN - 25 && p1.leverage < LEVERAGE_WIN) {
      const pick = pickRandom(GENERIC_QUIPS.p1NearWin);
      if (pick) return { ...pick, duration: 2800 };
    }
    if (p2.leverage >= LEVERAGE_WIN - 25 && p2.leverage < LEVERAGE_WIN) {
      const pick = pickRandom(GENERIC_QUIPS.p2NearWin);
      if (pick) return { ...pick, duration: 2800 };
    }
    if (p1.leverage <= LEVERAGE_PIN + 20 && p1.leverage > LEVERAGE_PIN) {
      const pick = pickRandom(GENERIC_QUIPS.p1NearPin);
      if (pick) return { ...pick, duration: 2800 };
    }
    if (p2.leverage <= LEVERAGE_PIN + 20 && p2.leverage > LEVERAGE_PIN) {
      const pick = pickRandom(GENERIC_QUIPS.p2NearPin);
      if (pick) return { ...pick, duration: 2800 };
    }
  }

  // Question-specific quips win when provided (remote bank can supply these).
  if (q) {
    if (p1c && p2c && q.quipCorrect) return { header: "BOTH CORRECT", text: q.quipCorrect, duration: 2400 };
    if (!p1c && !p2c && q.quipWrong) return { header: "BOTH WRONG", text: q.quipWrong, duration: 2400 };
  }

  // Generic fallback by outcome.
  let bucket, duration;
  if (p1c && p2c) { bucket = GENERIC_QUIPS.bothCorrect; duration = 2400; }
  else if (!p1c && !p2c) { bucket = GENERIC_QUIPS.bothWrong; duration = 2400; }
  else if (p1c) { bucket = GENERIC_QUIPS.p1Correct; duration = 1800; }
  else { bucket = GENERIC_QUIPS.p2Correct; duration = 1800; }

  const pick = pickRandom(bucket);
  if (!pick) return null;
  return { ...pick, duration };
}

function isRoundEnding() {
  if (state.tiebreakerPending) { state.tiebreakerPending = false; return true; }
  const p1 = state.players[0].leverage;
  const p2 = state.players[1].leverage;
  if (p1 >= LEVERAGE_WIN || p2 >= LEVERAGE_WIN) return true;
  if (p1 <= LEVERAGE_PIN || p2 <= LEVERAGE_PIN) return true;
  if (state.roundType === "strikes" && state.players.some(p => p.strikes >= 3)) return true;
  return state.roundQuestions >= ROUND_HARD_CAP;
}

// ============================================================
// DEAL PHASE - the hand-shove animation
// ============================================================
function updateDealPositions(isFinal) {
  const p1 = state.players[0];
  const p2 = state.players[1];

  els.handP1.style.left = handPositionStyle(p1.leverage);
  els.handP2.style.right = handPositionStyle(p2.leverage);
  els.handP1.style.transform = "";
  els.handP2.style.transform = "scaleX(-1)";

  // Briefcase leans toward whoever's closer to the center during play.
  const diff = p1.leverage - p2.leverage;
  const leanPct = Math.max(-20, Math.min(20, diff * 0.15));

  // At round resolution, the winning hand shoves the briefcase into the loser's chest.
  // Check both conditions independently — in SIMUL mode both players can hit WIN/PIN simultaneously.
  const p1WinCond = p1.leverage >= LEVERAGE_WIN || p2.leverage <= LEVERAGE_PIN;
  const p2WinCond = p2.leverage >= LEVERAGE_WIN || p1.leverage <= LEVERAGE_PIN;
  let winner = 0;
  if (p1WinCond && p2WinCond) winner = 0;
  else if (p1WinCond) winner = 1;
  else if (p2WinCond) winner = 2;
  else winner = diff > 0 ? 1 : (diff < 0 ? 2 : 0);

  if (isFinal && winner !== 0) {
    const shove = winner === 1 ? 35 : -35;
    els.briefcase.style.transform = `translateX(calc(-50% + ${shove}%))`;
    if (winner === 1) els.handP1.style.left = "calc(50% - 60px)";
    else els.handP2.style.right = "calc(50% - 60px)";
  } else {
    els.briefcase.style.transform = `translateX(calc(-50% + ${leanPct}%))`;
  }
  return { winner };
}

function showQuipSplash(header, text, duration, onDone) {
  if (!els.quipSplash) { if (onDone) onDone(); return; }
  els.quipSplashHeader.textContent = header || "";
  els.quipSplashText.textContent = text || "";
  els.quipSplash.classList.add("shown");
  setTimeout(() => {
    els.quipSplash.classList.remove("shown");
    setTimeout(() => { if (onDone) onDone(); }, 400);
  }, duration || 2600);
}

// ============================================================
// QUOTE SPLASH (famous author quotes before each round)
// ============================================================
const AUTHOR_QUOTES = [
  { text: "It is not enough to have a good mind; the main thing is to use it well.", author: "René Descartes" },
  { text: "The measure of intelligence is the ability to change.", author: "Albert Einstein" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Knowledge is power.", author: "Francis Bacon" },
  { text: "Imagination is more important than knowledge.", author: "Albert Einstein" },
  { text: "The unexamined life is not worth living.", author: "Socrates" },
  { text: "To know that we know what we know, and to know that we do not know what we do not know — that is true knowledge.", author: "Nicolaus Copernicus" },
  { text: "The beginning of wisdom is the definition of terms.", author: "Socrates" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Get your facts first, then you can distort them as you please.", author: "Mark Twain" },
  { text: "In the beginning was the Word, and the Word was with God.", author: "John 1:1" },
  { text: "All animals are equal, but some animals are more equal than others.", author: "George Orwell" },
  { text: "It was the best of times, it was the worst of times.", author: "Charles Dickens" },
  { text: "Ask not what your country can do for you — ask what you can do for your country.", author: "John F. Kennedy" },
  { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { text: "There is no greater agony than bearing an untold story inside you.", author: "Maya Angelou" },
  { text: "One must always be careful of boredom — it is the mother of all mischief.", author: "George Eliot" },
  { text: "The truth will set you free, but first it will make you miserable.", author: "James A. Garfield" },
  { text: "A word after a word after a word is power.", author: "Margaret Atwood" },
  { text: "If you tell the truth, you don't have to remember anything.", author: "Mark Twain" },
  { text: "Two roads diverged in a wood, and I — I took the one less traveled by.", author: "Robert Frost" },
  { text: "Hell is other people.", author: "Jean-Paul Sartre" },
  { text: "We are all just walking each other home.", author: "Ram Dass" },
  { text: "Do I dare disturb the universe?", author: "T.S. Eliot" },
  { text: "Everything I've ever let go of has claw marks on it.", author: "David Foster Wallace" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { text: "Man is condemned to be free.", author: "Jean-Paul Sartre" },
];

let usedQuoteIndices = [];

function pickRandomQuote() {
  if (usedQuoteIndices.length >= AUTHOR_QUOTES.length) usedQuoteIndices = [];
  let idx;
  do { idx = Math.floor(Math.random() * AUTHOR_QUOTES.length); }
  while (usedQuoteIndices.includes(idx) && usedQuoteIndices.length < AUTHOR_QUOTES.length);
  usedQuoteIndices.push(idx);
  return AUTHOR_QUOTES[idx];
}

function showQuoteSplash(quote, onDone) {
  if (!els.quoteSplash) { if (onDone) onDone(); return; }
  els.quoteText.textContent = "\u201C" + quote.text + "\u201D";
  els.quoteAttr.textContent = "\u2014 " + quote.author;
  els.quoteSplash.classList.add("shown");
  setTimeout(() => {
    els.quoteSplash.classList.remove("shown");
    setTimeout(() => { if (onDone) onDone(); }, 500);
  }, 2500);
}

function resetDealScene() {
  els.handP1.style.left = "2%";
  els.handP1.style.transform = "";
  els.handP2.style.right = "2%";
  els.handP2.style.transform = "scaleX(-1)";
  els.briefcase.style.transform = "translateX(-50%)";
  els.dealBanner.classList.remove("shown");
  if (els.briefcaseAmount && state.briefcaseValue) {
    els.briefcaseAmount.textContent = "$" + state.briefcaseValue;
  }
}

function startNextQuestionSameRound() {
  $("locked-p1")?.classList.remove("shown");
  $("locked-p2")?.classList.remove("shown");
  state.roundQuestions++;
  const q = randomQuestion();
  state.question = q;
  for (const p of state.players) {
    p.pickedChoice = null;
    p.answeredCorrect = false;
    p.strikesThisRound = 0;
    p.lockedOut = (state.roundType === "strikes") ? (p.strikes >= 3) : false;
  }
  state.firstCorrectPlayer = null;
  els.sectionTitle.textContent = q.category;
  els.roundType.textContent = roundTypeLabel();
  els.prompt.textContent = q.prompt;
  renderChoices();
  // Show a "ready" timer state during the reading window so it's clear the clock hasn't started
  els.timerFill.style.transition = "none";
  els.timerFill.style.width = "100%";
  els.timerFill.classList.remove("warning");
  setTimeout(() => beginQuestion(), 1200);
}

function runDealPhase() {
  const p1 = state.players[0];
  const p2 = state.players[1];

  // --- Determine winner ---
  // If tiebreakerPayout is set, we're resolving the tiebreaker question by correctness.
  const isTiebreakerResolution = state.tiebreakerPayout !== null;
  let winner, payout;

  if (isTiebreakerResolution) {
    payout = state.tiebreakerPayout;
    state.tiebreakerPayout = null;
    const p1c = p1.answeredCorrect;
    const p2c = p2.answeredCorrect;
    if (p1c && !p2c) winner = 1;
    else if (p2c && !p1c) winner = 2;
    else winner = 0;
    updateDealPositions(winner !== 0);
  } else {
    const result = updateDealPositions(true);
    winner = result.winner;
    payout = winner ? state.briefcaseValue : 0;
  }

  // ---- Banner + cash ----
  setTimeout(() => {
    let bannerText, color;

    if (isTiebreakerResolution) {
      if (winner === 1) {
        bannerText = `PLAYER 1 WINS THE BRIEFCASE (TIEBREAKER)  +$${payout}\n(P1 locked in correctly)`;
        color = "var(--p1-color)";
        state.players[0].cash += payout;
      } else if (winner === 2) {
        bannerText = `PLAYER 2 WINS THE BRIEFCASE (TIEBREAKER)  +$${payout}\n(P2 locked in correctly)`;
        color = "var(--p2-color)";
        state.players[1].cash += payout;
      } else {
        bannerText = `TIEBREAKER STALEMATE — NO DEAL\n(Both or neither answered correctly)`;
        color = "#555";
      }
    } else {
      const levStr = `(Leverage: P1 ${p1.leverage} vs P2 ${p2.leverage})`;
      if (winner === 1) {
        bannerText = `PLAYER 1 WINS THE BRIEFCASE  +$${payout}\n${levStr}`;
        color = "var(--p1-color)";
        state.players[0].cash += payout;
      } else if (winner === 2) {
        bannerText = `PLAYER 2 WINS THE BRIEFCASE  +$${payout}\n${levStr}`;
        color = "var(--p2-color)";
        state.players[1].cash += payout;
      } else {
        bannerText = `TIEBREAKER!\nEqual leverage — one secret lock-in decides the briefcase!`;
        color = "#c8960c";
      }
      // Penalty for finishing a normal round with negative leverage
      for (const p of state.players) {
        if (p.leverage < 0) {
          const loss = Math.min(p.cash, Math.min(30, Math.floor(Math.abs(p.leverage) / 5)));
          p.cash -= loss;
        }
      }
    }

    els.dealBannerText.textContent = bannerText;
    els.dealBanner.style.background = `linear-gradient(to bottom, ${color}, #000)`;
    els.dealBanner.style.color = "white";
    els.dealBanner.classList.add("shown");

    if (winner) flyMoney(winner, payout);
    updateHUD();
  }, 900);

  // ---- Move on ----
  if (!isTiebreakerResolution && winner === 0) {
    // Stalemate: queue a tiebreaker question instead of the next round.
    state.tiebreakerPayout = state.briefcaseValue;
    setTimeout(() => {
      els.dealBanner.classList.remove("shown");
      setTimeout(() => startTiebreakerQuestion(), 900);
    }, 3200);
  } else {
    setTimeout(() => {
      state.phase = "between";
      els.dealBanner.classList.remove("shown");
      setTimeout(() => nextRound(), 900);
    }, 3200);
  }
}

function startTiebreakerQuestion() {
  // Sudden-death SIMUL question: winner is whoever answers correctly, not leverage.
  state.roundType = "simul";
  state.tiebreakerPending = true;

  const q = randomQuestion();
  if (!q) { state.tiebreakerPayout = null; return nextRound(); }
  state.question = q;
  state.roundQuestions++;
  for (const p of state.players) {
    p.pickedChoice = null;
    p.answeredCorrect = false;
    p.lockedOut = false;
    p.leverage = 0;
    p.strikesThisRound = 0;
  }
  state.firstCorrectPlayer = null;
  $("locked-p1")?.classList.remove("shown");
  $("locked-p2")?.classList.remove("shown");

  els.sectionTitle.textContent = q.category;
  els.roundType.textContent = "TIEBREAKER — LOCK-IN";
  els.prompt.textContent = q.prompt;
  renderChoices();
  resetDealScene();
  updateHUD();

  els.timerFill.style.transition = "none";
  els.timerFill.style.width = "100%";
  els.timerFill.classList.remove("warning");

  state.phase = "question";
  setTimeout(() => beginQuestion(), 1200);
}

function flyMoney(winner, amount) {
  // Emit N little money bills from briefcase to winner's panel
  const bills = Math.min(8, Math.max(3, Math.round(amount / 30)));
  const briefRect = els.briefcase.getBoundingClientRect();
  const targetRect = (winner === 1 ? els.panelP1 : els.panelP2).getBoundingClientRect();
  const areaRect = els.dealArea.getBoundingClientRect();

  for (let i = 0; i < bills; i++) {
    const bill = document.createElement("div");
    bill.className = "money-fly";
    bill.textContent = "$";
    const startX = briefRect.left - areaRect.left + 20;
    const startY = briefRect.top - areaRect.top + 10;
    bill.style.left = startX + "px";
    bill.style.top = startY + "px";
    els.dealArea.appendChild(bill);

    // Target roughly the center of the cash counter
    const endX = (winner === 1 ? 30 : areaRect.width - 70) + (Math.random() - 0.5) * 30;
    const endY = -40 + Math.random() * 20;

    bill.animate([
      { left: startX + "px", top: startY + "px", opacity: 1, transform: "scale(1)" },
      { opacity: 1, offset: 0.7 },
      { left: endX + "px", top: endY + "px", opacity: 0, transform: "scale(0.5)" }
    ], {
      duration: 900 + Math.random() * 300,
      delay: i * 80,
      easing: "cubic-bezier(0.4, 0.0, 0.6, 1)",
      fill: "forwards"
    });
    setTimeout(() => bill.remove(), 1500 + i * 80);
  }
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
  $("cash-p1").textContent = state.players[0].cash;
  $("cash-p2").textContent = state.players[1].cash;
  $("leverage-p1").textContent = state.players[0].leverage;
  $("leverage-p2").textContent = state.players[1].leverage;
  renderStrikes(1);
  renderStrikes(2);
  if (state.briefcaseValue) {
    if (els.briefcaseAmount) els.briefcaseAmount.textContent = "$" + state.briefcaseValue;
    const hudEl = $("briefcase-hud");
    if (hudEl) hudEl.textContent = "BRIEFCASE  $" + state.briefcaseValue;
  }
  // Highlight who's "active" (has the most leverage this round)
  els.panelP1.classList.toggle("active", state.players[0].leverage > state.players[1].leverage && state.players[0].leverage > 0);
  els.panelP2.classList.toggle("active", state.players[1].leverage > state.players[0].leverage && state.players[1].leverage > 0);
}

function renderStrikes(pNum) {
  const wrap = $("strikes-p" + pNum);
  const tot = state.players[pNum - 1].strikes + (state.players[pNum - 1].strikesThisRound || 0);
  const kids = wrap.querySelectorAll(".strike-x");
  kids.forEach((k, i) => {
    k.classList.toggle("active", i < Math.min(3, tot));
  });
}

// ============================================================
// MODAL
// ============================================================
let modalReadyFlags = [false, false];
let modalReadyCallback = null;

function markModalReady(playerIdx) {
  if (modalReadyFlags[playerIdx]) return;
  modalReadyFlags[playerIdx] = true;
  const dot = document.getElementById(`modal-ready-p${playerIdx + 1}`);
  if (dot) dot.classList.add("ready");
  const allReady = state.players.every((p, i) => !p.isHuman || modalReadyFlags[i]);
  if (!allReady) return;
  if (!modalReadyCallback) return;
  const cb = modalReadyCallback;
  modalReadyCallback = null;
  hideModal();
  cb();
}

function showModal({ title, subtitle, detail, actions, requireBothPlayers }) {
  els.modalTitle.textContent = title;
  els.modalSub.textContent = subtitle || "";
  els.modalDetail.textContent = detail || "";
  els.modalActions.innerHTML = "";
  modalReadyCallback = null;

  if (requireBothPlayers) {
    modalReadyFlags = [false, false];
    modalReadyCallback = actions[0].onclick;
    const readyDiv = document.createElement("div");
    readyDiv.className = "modal-both-ready";
    readyDiv.innerHTML = `<div class="quote-ready-dot p1" id="modal-ready-p1"></div><span>PRESS A TO BEGIN</span><div class="quote-ready-dot p2" id="modal-ready-p2"></div>`;
    els.modalActions.appendChild(readyDiv);
    // Make the ready dots clickable and keyboard-activatable so mouse users
    // can also mark their player as ready. Clicking left/right of the
    // container will infer P1/P2 based on click position.
    const dot1 = document.getElementById('modal-ready-p1');
    const dot2 = document.getElementById('modal-ready-p2');
    const attachDotHandlers = (dot, idx) => {
      if (!dot) return;
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      dot.addEventListener('click', (ev) => { ev.stopPropagation(); markModalReady(idx); });
      dot.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); markModalReady(idx); } });
    };
    attachDotHandlers(dot1, 0);
    attachDotHandlers(dot2, 1);
    // Clicks on the ready container also map to a player based on horizontal position
    readyDiv.addEventListener('click', (ev) => {
      try {
        const rect = readyDiv.getBoundingClientRect();
        const player = (ev.clientX < (rect.left + rect.width / 2)) ? 1 : 2;
        markModalReady(player - 1);
      } catch (err) {
        markModalReady(0);
      }
    });
    for (let i = 0; i < state.players.length; i++) {
      if (!state.players[i].isHuman) markModalReady(i);
    }
  } else {
    for (const a of (actions || [])) {
      const b = document.createElement("button");
      b.className = "luna-btn" + (a.primary ? " primary" : "");
      b.textContent = a.label;
      b.addEventListener("click", a.onclick);
      els.modalActions.appendChild(b);
    }
  }

  // Set modal focus to the first action and show it
  modalFocus = 0;
  updateModalFocus();
  els.modal.classList.add("active");
}
function hideModal() {
  els.modal.classList.remove("active");
  // clear focused state on buttons
  if (els.modalActions) {
    const btns = els.modalActions.querySelectorAll('button');
    btns.forEach(b => b.classList.remove('focused'));
  }
}

function showHelpModal() {
  const detail = [
    'Controls:',
    'Player 1: 1 2 3 4 (A/B/C/D)',
    'Player 2: 7 8 9 0 (A/B/C/D)',
    'Escape: return to main menu',
    '',
    'Round types:',
    '- Buzz-In: First correct answer earns leverage. A wrong buzz locks you out and costs leverage.',
    '- Simultaneous: Players lock in answers secretly; both reveal together. Correct picks gain leverage, wrong or missing picks lose it.',
    '- Three Strikes: Wrong answers add strikes AND drop leverage. Correct answers remove a strike. Three strikes ends the round immediately.',
    '',
    'Leverage & payout:',
    '- Each player\'s hand on screen is their leverage meter. Reach the briefcase (+100) to win the round — your hand shoves it into the opponent\'s chest.',
    '- Get pinned to the back wall (-60) and your opponent takes the round.',
    '- Otherwise the round ends after 15 questions; whoever has more leverage wins.',
    '- Briefcase values escalate every round (final round is doubled). Cash — not leverage — wins the overall game.',
    '- Negative leverage at round end still costs you cash (up to $30).',
    '',
    'Tips:',
    '- Simultaneous picks are hidden until reveal; press indicators appear only after resolution.',
    '- In Three Strikes rounds, be conservative — wrong answers add strikes.'
  ].join('\n');

  showModal({
    title: 'GAME HELP',
    subtitle: 'Controls, rounds, and leverage',
    detail,
    actions: [ { label: 'Close', primary: true, onclick: () => { hideModal(); } } ]
  });
}

// ============================================================
// END OF GAME
// ============================================================
function endGame() {
  state.phase = "idle";
  const p1 = state.players[0].cash;
  const p2 = state.players[1].cash;
  const winner = p1 > p2 ? 1 : (p2 > p1 ? 2 : 0);
  let title, sub;
  if (winner === 0) {
    title = "DRAW";
    sub = `Both hustled their way to $${p1}.`;
  } else {
    title = `PLAYER ${winner} WINS`;
    sub = `$${state.players[winner - 1].cash} vs $${state.players[1 - (winner - 1)].cash}`;
  }
  HardballAudio.playMusic("endgame");
  showModal({
    title, subtitle: sub,
    detail: "Rematch?",
    actions: [
      { label: "▶ Play Again", primary: true, onclick: () => { hideModal(); startGame(); } },
      { label: "Main Menu", onclick: () => { hideModal(); showScene("title"); } }
    ]
  });
}

// ============================================================
// AUDIO INIT
// ============================================================
HardballAudio.init();
HardballAudio.playMusic("title");

// Auto-test harness: if URL contains ?autoTest=simul this will simulate a simultaneous round
(function autoTestHarness() {
  try {
    const params = new URLSearchParams(location.search);
    if (!params.has('autoTest')) return;
    const test = params.get('autoTest');
    console.log('AUTO TEST:', test);
    const resultDiv = document.createElement('div');
    resultDiv.style.position = 'fixed';
    resultDiv.style.left = '8px';
    resultDiv.style.bottom = '8px';
    resultDiv.style.zIndex = 9999;
    resultDiv.style.background = 'rgba(0,0,0,0.75)';
    resultDiv.style.color = 'white';
    resultDiv.style.padding = '8px 12px';
    resultDiv.style.borderRadius = '6px';
    resultDiv.style.fontWeight = 'bold';
    resultDiv.textContent = 'AutoTest running...';
    document.body.appendChild(resultDiv);

    if (test === 'simul') {
      // Force a single simultaneous round using the first question in the pool
      state.totalRounds = 1;
      state.round = 0;
      state.question = POOL[0];
      state.roundType = 'simul';
      for (const p of state.players) {
        p.pickedChoice = null; p.lockedOut = false; p.answeredCorrect = false; p.strikesThisRound = 0;
      }
      showScene('game');
      // Start the question phase
      beginQuestion();

      // Simulate P1 then P2 picking different choices
      setTimeout(() => {
        handlePlayerInput(1, 0); // P1 picks choice 0
        // Check press indicators remain hidden
        const p1dot = document.querySelector('.press-dot.p1.shown');
        const p2dot = document.querySelector('.press-dot.p2.shown');
        const beforeHidden = !p1dot && !p2dot;
        console.log('Before reveal, indicators shown?', !!p1dot, !!p2dot);
        resultDiv.textContent = 'Before reveal hidden: ' + beforeHidden;

        handlePlayerInput(2, 1); // P2 picks choice 1
        const p1dot2 = document.querySelector('.press-dot.p1.shown');
        const p2dot2 = document.querySelector('.press-dot.p2.shown');
        const stillHidden = !p1dot2 && !p2dot2;
        console.log('After both pick, indicators shown?', !!p1dot2, !!p2dot2);
        resultDiv.textContent = 'Before reveal hidden: ' + (beforeHidden && stillHidden);
      }, 200);

      // After resolution, ensure indicators are revealed
      setTimeout(() => {
        // give resolution time to run (resolveQuestion schedules a reveal)
        setTimeout(() => {
          const p1Shown = !!document.querySelector('.press-dot.p1.shown');
          const p2Shown = !!document.querySelector('.press-dot.p2.shown');
          const pass = p1Shown && p2Shown;
          console.log('After reveal, indicators shown?', p1Shown, p2Shown);
          if (pass) {
            resultDiv.style.background = 'green';
            resultDiv.textContent = 'AUTO TEST PASS — simultaneous picks hidden until reveal';
          } else {
            resultDiv.style.background = '#800000';
            resultDiv.textContent = 'AUTO TEST FAIL — picks visible prematurely';
          }
        }, 900);
      }, 900);
    }
  } catch (err) {
    console.error('AutoTest error', err);
  }
})();
