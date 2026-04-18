# Hardball — The Trivia Negotiation

A two-player trivia battle with a *Theme Park*-inspired negotiation phase.
Correct answers earn **leverage**. Leverage decides who walks away from the
briefcase with the money — and whose cartoon hand gets shoved across the table.

## Running the game

No build step. Just open `index.html` in a browser.

```
# Optional: serve it so you can hot-swap questions.json without CORS pain
python -m http.server 8000
# then visit http://localhost:8000
```

## Controls

- **Player 1:** keys `1` `2` `3` `4` (A / B / C / D), or **Gamepad 1** face buttons
- **Player 2:** keys `7` `8` `9` `0` (A / B / C / D), or **Gamepad 2** face buttons
- **Escape:** bail to main menu

## Round types

| Type          | Behavior |
|---------------|----------|
| Buzz-In       | First correct answer grabs all the leverage. A wrong buzz locks you out. |
| Simultaneous  | Both players secretly lock in a pick. Reveal together — correct = leverage. |
| Three Strikes | Wrong answers stack strikes (3 = locked out). A correct answer *reverses* one of your opponent's strikes. |

Rounds cycle through the three types. Best-of-N cash total wins.

## Using your own `promptukit` question banks

The game reads the **exact JSON schema** that `promptukit` produces. Right now
the bank is embedded in `index.html` inside the `QUESTION_BANK` constant. Two
ways to swap it:

### Option A — paste a new bank in

Generate a bank with your CLI:

```
poetry run question-bank create --dest mybank.json --categories trivia,general
poetry run add-question --batch new_questions.json mybank.json
```

Open `mybank.json`, copy the contents, and replace the `QUESTION_BANK` object
literal in `index.html`.

### Option B — fetch it at runtime

Replace the `QUESTION_BANK` block in `index.html` with:

```js
const POOL = await fetch("mybank.json").then(r => r.json()).then(flattenBank);
```

You'll need to wrap the init code in an async IIFE — see the
`flattenBank` function, which already accepts any of the schema variants
(`sections`, `categories`, flat arrays, etc.) that `promptukit` supports.

### Expected question fields

The loader is promptukit-tolerant. It reads any of:

- `prompt` / `q` / `question` / `text` — the question text
- `choices` / `answers` — an array of answer strings
- `answer` / `correct` / `correct_index` — zero-indexed correct choice
- `difficulty` — currently informational only
- `category` — used to group flat lists into sections

Example question:

```json
{
  "prompt": "Who directed Ponyo?",
  "choices": ["Isao Takahata", "Mamoru Hosoda", "Hayao Miyazaki", "Makoto Shinkai"],
  "answer": 2,
  "difficulty": "easy"
}
```

**Heads up:** `promptukit`'s README shows question banks without an explicit
`answer` field (the PDF exam flow doesn't need one). For the game, each
question needs an `answer` index. You may want to extend your bank format,
or add a tiny script that auto-labels the first choice as correct and
shuffles on load.

## Design notes / next moves

- **Aesthetic:** Luna/Aero chrome, Tahoma display, glossy beveled buttons,
  SVG cartoon hands with thick ink outlines. No image assets — everything is
  CSS gradients + SVG so it stays pixel-sharp at any zoom.
- **Payout formula:** `payout = max(20, |leverageDiff| * 5)`. Negative leverage
  (wrong answers, no-shows) can also *lose* you up to $15 in a round.
- **Hand animation:** the winner's hand settles near center; the loser's gets
  shoved back toward their sideline and rotated off-angle, scaled by
  leverage intensity. The briefcase slides toward the winner.
- **Ideas to try next:**
  - Seeded runs (steal the pattern from your Pitch Perfect roguelike)
  - "Tell" system — a micro-animation leaks which choice the opponent is
    about to pick on the Simultaneous round
  - Power-up cards (Theme Park had them too): "Double or nothing",
    "Strike forgiveness", "Reveal one wrong answer"
  - Question difficulty → payout multiplier
  - Online multiplayer via a tiny WebSocket relay
