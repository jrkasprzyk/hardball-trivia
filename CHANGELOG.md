# Changelog

All notable changes to Hardball will be documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/).

## [0.1.2] - 2026-04-19

### Added
- Splash screens between rounds: quote splash and quip recap before each new round
- Title screen redesigned: split layout, larger panel text, visible focus ring, full controller navigation
- Question bank selector on title screen
- Both-press-A instruction moved to round rules modal

### Fixed
- Mute state now correctly restores audio on unmute
- P1-priority tie bug corrected; SIMUL tiebreaker added for stalemates

## [0.1.1] - 2026-04-18

### Added
- Three-Strikes round type: multi-question sequence, 3 strikes locks a player out; correct answers remove one opponent strike
- CSS extracted to `styles.css`; no build step required
- Controller keybinding hints visible on title screen

## [0.1.0] - 2026-04-17

### Added
- Initial release
- Buzz-In and Simultaneous round types
- Gamepad (Xbox-style) support
- Background music and sound effects with mute toggle
- Auto-test harness (`?autoTest=simul`)
