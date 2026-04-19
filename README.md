## Hardball — The Trivia Negotiation (v0.1.2)

Small local demo of the trivia-negotiation prototype. Two players compete
across a sequence of rounds; each round type uses a different answering
mechanic and awards "leverage" which determines who wins the briefcase.

Quick highlights in v0.1.2
- Title screen redesigned: split layout, larger panel text, visible focus ring, full controller navigation.
- Splash screens between rounds: quote splash and quip recap before each new round.
- Mute fix: mute state now correctly restores audio on unmute; controller keybinding hints visible on title.
- Three-Strikes rounds run as a multi-question sequence until a player accumulates 3 strikes (locks out). Correct answers remove one opponent strike.
- CSS extracted to `styles.css`; no build step required.

## Running the game

No build step. Open `index.html` in a modern browser.

For local dev, serve the folder so `questions.json` hot-swaps and relative paths resolve correctly:

```bash
python -m http.server 8067
# then visit http://localhost:8067
```

## Audio

Background music and sound effects play automatically once you interact with the page (browser autoplay policy).

**Asset layout** — create an `audio/` folder at the project root:

```
audio/
  music/
    title.ogg     title.mp3      ← title-screen loop
    gameplay.ogg  gameplay.mp3   ← in-game loop
    endgame.ogg   endgame.mp3    ← post-game screen
  sfx/
    click.ogg     click.mp3      ← answer selection
```

Provide OGG and/or MP3; the engine picks the first format the browser supports. WAV sources can be converted with ffmpeg (e.g., `ffmpeg -i src.wav -q:a 4 output.ogg`).

**Mute:** press `M` or click the `♪` icon in the statusbar. Mute state persists across sessions.

## Controls

**Keyboard**
- Player 1: keys `1 2 3 4` (A/B/C/D)
- Player 2: keys `7 8 9 0` (A/B/C/D)
- `Escape`: return to main menu
- `M`: toggle mute

**Gamepad (Xbox-style)**
- Face buttons (A/B/X/Y): answer selection / join / confirm
- D-pad: navigate menus
- `Y`: join game (title screen)
- `≡ Menu`: toggle mute
- `⧉ View`: return to main menu

## Round types (summary)

- Buzz-In — First correct answer wins the entire pot. Wrong buzz locks you out for that question.
- Simultaneous — Players lock in answers secretly; both reveal together. Correct answers earn leverage.
- Three Strikes — Wrong answers add strikes. The round continues with new questions until a player reaches 3 strikes and becomes locked out. Correct answers remove one opponent strike.

Rounds cycle in order: Buzz-In → Simultaneous → Three Strikes.

## Leverage & scoring

- Leverage is a per-round numeric score awarded based on correctness and round type. The player with higher leverage "wins the deal" and receives cash.
- Payout formula used in this demo: `payout = max(20, Math.round(|leverageDiff| * 5))`.
- Negative leverage (for wrong answers or no-shows) can cause small cash losses.

## Using your own question banks

The game accepts banks in the promptukit-friendly schema. By default a small
embedded bank is used (so `index.html` works over `file://`). To swap banks:

- Paste a JSON bank into the `QUESTION_BANK` object in `index.html`.
- Or serve a JSON file and modify the remote loading URL in `index.html`.

Expected fields: `prompt` (or `q`/`question`), `choices` (array), `answer` (zero-index), `difficulty` (optional), `category` (optional).

## Dev & testing tips

- Auto-test harness: open `index.html?autoTest=simul` to run a quick simultaneous-round smoke test.
- To iterate on questions while serving: run `python -m http.server 8067` and edit `questions.json` or host your JSON bank.

## Next steps (ideas)

- Add clearer in-game help modal explaining leverage numbers and penalties.
- Implement persistent high scores and seeded match replays.
