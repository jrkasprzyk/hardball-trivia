## Hardball — The Trivia Negotiation (v0.1.1)

Small local demo of the trivia-negotiation prototype. Two players compete
across a sequence of rounds; each round type uses a different answering
mechanic and awards "leverage" which determines who wins the briefcase.

Quick highlights in v0.1.1
- Three-Strikes rounds now run as a multi-question sequence until a player
  accumulates 3 strikes (locks out). Correct answers in strikes rounds
  remove one opponent strike.
- Clarified leverage and payout behavior in UI and README.

## Running the game

No build step. Open `index.html` in a modern browser.

Optional: serve the folder for easier testing and hot-swapping `questions.json`:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Controls

- Player 1: keys `1 2 3 4` (A/B/C/D) or Gamepad 1 face buttons
- Player 2: keys `7 8 9 0` (A/B/C/D) or Gamepad 2 face buttons
- `Escape`: return to main menu

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
- To iterate on questions while serving: run `python -m http.server` and edit `questions.json` or host your JSON bank.

## Next steps (ideas)

- Add clearer in-game help modal explaining leverage numbers and penalties.
- Implement persistent high scores and seeded match replays.
- Small accessibility improvements: focus outlines, ARIA labels for dynamic elements.

---

If you want, I can also add a short in-game HELP modal and update the pause/menu text. This README edit completes the v0.1.1 doc updates.
