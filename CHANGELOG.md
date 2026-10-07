# Changelog

All notable changes to SAGE. Version numbers follow [semantic versioning](https://semver.org/): new features bump the middle number, fixes bump the last.

## 1.1.0

### Added
- **Autosave to a file** (Chrome and Edge): choose a save file once and SAGE keeps it up to date, so decks survive cleared browser data. **Use an existing save file** picks up where you left off on another computer.
- **Backup reminder:** a gentle note with a one-click backup when nothing has been saved outside the browser for a week.
- **Storage protection:** SAGE asks the browser not to clear its data on its own when space runs low.
- The backup window now shows when you last saved a backup and whether storage protection is on.
- **Hint button** under the terminal for Terminal and Survival, so both work on phones and tablets without a Tab key.
- **Longer timed games for skilled players:** in Terminal every typed word adds a second; in Lightning right answers add 5 seconds (3 after five minutes) and wrong answers take 5 away.
- The AI study guide **retries automatically** when the provider is busy, and for Gemini switches to a backup model if needed.

### Changed
- **Fairer fill-in-the-blank questions** in the quiz and Terminal: blanks favor key terms, the decoy words fit the same spot in the sentence (same kind of ending, similar length), and when options mix capitals and lower case they're all shown in lower case, so neither grammar nor capitals give the answer away.
- Terminal no longer turns a wrong guess red until it's 5 letters long, is a complete wrong option, or is longer than every option, so colors can't reveal the answer letter by letter.
- Default Gemini model is now `gemini-3.5-flash-lite`, with a much larger free daily allowance than full Flash models.
- On phones, Scramble rocks stop growing at a set size (long text spills over the rock instead), Blast text sits on top of the planet instead of being cut off, and the header buttons take less space.
- Lightning's time setting is now the starting time.
- The code is now split into readable source files under `src/` and built into the single `sage.html` with `build.py`. Nothing changes for users.
- Added automated end-to-end tests and a GitHub workflow that runs them on every push.

## 1.0.0

First public release: spaced-repetition flash cards, quiz, seven study games, deck editor, AI study guide, and in-app help.
