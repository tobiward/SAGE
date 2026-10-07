# SAGE

**Study with Adaptive Gaming Environments**

A free, private study app in a single file: spaced-repetition flash cards, a printable-style quiz, several study games, and an optional AI study guide, all built from your own notes. No account, no ads, no install.

<!-- Screenshots go here, for example:
![Deck list](docs/decks.png)
![Flash cards](docs/flashcards.png)
![Blast](docs/blast.png)
![Quiz](docs/quiz.png)
-->

**[Use SAGE online](#) · [Download sage.html](#)**
<!-- Replace the two # links after publishing:
     online:   https://YOUR-NAME.github.io/YOUR-REPO/
     download: https://github.com/YOUR-NAME/YOUR-REPO/releases/latest/download/sage.html -->

Everything in this README also appears in the app under **Help**.

## Getting started

1. Download `sage.html`.
2. Keep it on your desktop (or a shortcut to it; see [Desktop icon](#give-sage-its-own-desktop-icon)).
3. Double-click it whenever you want to study, just like opening an app. It opens in your web browser and works offline.
4. Click **Import CSV** and choose a file, or paste text. Pick which column is the front and which is the back.
5. Press **Flash cards** on your deck to study. Flip a card, then rate how well you knew it.
6. Try the **Quiz** to test yourself or **Games** for practice. Use **Options → Edit cards** to fix or add cards.

## Making cards

A **CSV** is plain text where each line is one card: the front, a comma, then the back.

```csv
Front,Back
Mitochondria,Powerhouse of the cell
Osmosis,Water moving across a membrane
```

**No CSV? Let a free AI chat make one.**

1. Open a free AI chat such as Claude, Gemini, or ChatGPT.
2. Type **"Make this into a CSV file"**, then paste your notes, or attach photos, screenshots, or a PDF of them.
3. Copy the reply, then in SAGE choose **Import CSV**, open **Or paste text instead**, paste, and press **Use pasted text**.

**From a spreadsheet:** put fronts in column A and backs in column B, then save or download as CSV (in Excel, choose "CSV UTF-8"). You can also copy the two columns and paste them straight into the paste box.

**More than two columns?** SAGE keeps every column. Later, in **Options → Edit cards**, you can choose which columns appear on each side, including several on one side.

Prefer to skip hopping between platforms? The built-in [AI study guide](#ai-study-guide-and-free-api-keys) does all of this inside SAGE once you add an API key.

### What can I paste?

One card per line or table row, with the **front first** and the **back second**. Any of these work, even when they sit inside a longer AI reply; extra sentences around the cards are ignored.

| Format | Example |
| --- | --- |
| Comma separated | `Mitochondria,Powerhouse of the cell` |
| Quoted (use quotes when the text has commas) | `"Mitochondria", "Powerhouse, of the cell"` |
| Tab separated (copying two columns from Excel or Google Sheets) | `Mitochondria⇥Powerhouse of the cell` |
| Tables from AI chats | `\| Mitochondria \| Powerhouse of the cell \|` |
| Lists, one per line, with or without bullets or numbers | `Mitochondria: Powerhouse of the cell` or `Mitochondria - Powerhouse of the cell` |

A header row like `Front,Back` or `Term,Definition` is optional; SAGE spots it and lets you confirm. Semicolons work in place of commas too. Files can be `.csv`, `.tsv`, or `.txt`.

## Flash cards

- Each deck shows **New** (never studied), **Learning** (seen recently, coming back soon), and **Due** (ready for review today).
- After flipping a card, rate it: **Again** if you forgot, **Hard**, **Good**, or **Easy**. Each button shows when you'll see the card next.
- Cards you know well come back less and less often. That's spaced repetition, and it's why a few minutes a day beats cramming. Scheduling uses FSRS-5, an open-source spaced repetition algorithm.
- Set new cards per day, cards per session, and target recall in **Options**. A new study day starts at 4 AM.
- Done for the day? Press **Flash cards** again for **Study more**: extra new cards, reviewing early, or free practice.

Keyboard: **Space** flips the card, **1** to **4** rate it.

## Quiz, games, and the deck editor

**Quiz:** a one-page test answered with the mouse: multiple choice, true or false, and fill in the missing word. Choose how many questions, which side is the answer, and whether answers are marked as you go or when you submit. Optionally, missed questions mark those cards as Hard in flash cards so they come back right away.

**Games** never change your study schedule. Each has its own options on the Settings tab, and most pause with **P**.

| Game | How it plays |
| --- | --- |
| **Matching Tiles** | Pair fronts with backs against the clock. |
| **Matching Pairs** | Wire each item on the left to its match on the right. |
| **Scramble** | Shoot the falling rock with the right answer. |
| **Blast** | Shoot the right planet and clear each level before time runs out. |
| **Terminal** | Type each card, choosing the missing word from four options. |
| **Survival** | Type just the missing word from memory, with 3 lives. |
| **Lightning** | Decide true or false as fast as you can. |

**Deck editor** (**Options → Edit cards**): add, edit, delete (with undo), search, and reorder cards. New cards are studied in the order shown.

## AI study guide and free API keys

The **AI study guide** turns notes, photos, PDFs, or text files into flash cards plus study tips, and can use your study stats to point out weak spots. It needs an **API key**: a password that lets SAGE talk to an AI for you.

**Recommended free option: Google Gemini.** It has a free tier, usually needs no credit card, and reads photos and PDFs.

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and sign in with a Google account.
2. Click **Create API key**, then copy the key (it starts with `AIza`).
3. In SAGE, open **AI study guide**, choose **Google Gemini**, and paste the key. The model box fills in `gemini-3.5-flash`, a stable free-tier model that handles images and PDFs. Google releases newer Flash versions often; you can type a newer model name into the box anytime.

- **Choose a model that can read images and files.** Text-only models can't use photos or PDFs.
- **Free means rate-limited.** If you see "too many requests," wait a minute. Free limits change from time to time; AI Studio shows the current ones.
- **Privacy:** Google says free-tier requests may be used to improve its products, so avoid sending anything private.
- **Other options:** Anthropic (Claude) and OpenAI, or any service with an OpenAI-style API, work too. They're pay-as-you-go; a study guide typically costs a few cents.
- **The instructions are yours to edit.** Change the **Instructions for the AI** box to get more cards, simpler wording, or another language. **Reset to default** brings back the original.

## Saving, backups, and updating

- Everything saves automatically in your browser on your computer. There's no account.
- Clearing your browser's history or site data deletes your decks. Opening SAGE in a different browser starts empty.
- Use **Backup → Export backup** every so often. To move to another computer or browser, export there and choose **Restore from backup** here.
- Leave `sage.html` where it is. In some browsers, moving or renaming it can hide your saved decks (restoring a backup brings them back).
- The website version and a downloaded copy keep separate decks. Pick one, or use a backup to move between them.

**Updating SAGE:** your decks live in the browser, not in the file, so updating doesn't erase them.

1. Export a backup, just in case.
2. Download the new `sage.html` and put it exactly where the old one was, with the same name, replacing it.
3. Open it. Your decks are still there. The version number is at the bottom of the page.

Using the website version? Updates arrive automatically; just refresh.

## Give SAGE its own desktop icon

A plain HTML file shows your browser's logo. Download `sage.ico` (Windows) or `sage-icon.png` (Mac) from the latest release and keep it next to `sage.html`.

**Windows**

1. Keep `sage.html` and `sage.ico` together in a folder, such as Documents\SAGE.
2. Right-click `sage.html`, choose **Show more options → Send to → Desktop (create shortcut)**.
3. Right-click the new shortcut, choose **Properties → Change Icon → Browse**, pick `sage.ico`, and press OK. Rename the shortcut to SAGE.

**Mac**

1. Open `sage-icon.png` in Preview, then choose **Edit → Select All** and **Edit → Copy**.
2. Click `sage.html` in Finder and choose **File → Get Info**.
3. Click the small icon at the top left of the Info window and press **Command+V**.

**Website version:** in Chrome or Edge, open the browser menu and choose **Install** or **Create shortcut** (tick "Open as window") to get a SAGE icon on your desktop.

## Privacy and safety

- No account, no ads, no tracking. Your cards never leave your browser except when you use the AI study guide.
- SAGE only contacts the internet for its fonts (Google Fonts; offline it uses your system fonts), and for the AI provider you set up, only when you press **Create study guide**. Your material, and your deck stats if you chose to include them, go directly to that provider under its privacy terms.
- SAGE only runs its own code. A content security policy blocks outside scripts, card text is always shown as plain text, and backup files are checked and cleaned before they're restored.
- Your API key stays in your browser and is never included in backups. Use **Forget key** on shared computers, and set a spending limit with your AI provider if it's a paid one.

## Supporting SAGE

SAGE is free. If it helps you, the **Donate** link under the SAGE logo shows crypto addresses and QR codes for tips. Don't want to see it? Hide it on the donate page or in **Help**, and bring it back anytime.

**Always check that an address in the app matches one listed here before sending.** Copies of SAGE shared elsewhere could have different addresses.

- **Bitcoin (BTC):** `bc1q9tyjr2xz9jye3ehu2v3kp9hfm2yl0rgm4hucyt`
- **Ethereum (ETH):** `0x34697611D36C23cAa5f849b0146BA8A01384C761`
- **Solana (SOL):** `AYr2VmvZ6PUJrjgoi6RwD8C4uzWMhJs8ZNdhzkC2cNuC`

## Troubleshooting

<details><summary>My decks disappeared</summary>

They're tied to the browser and the file's location. Open SAGE in the same browser you used before, from the same folder. If your browser data was cleared, restore your latest backup.
</details>

<details><summary>Pasted text says it couldn't find any cards</summary>

Each card needs a front and a back on one line or table row. See [What can I paste?](#what-can-i-paste) for formats that work. If you pasted an AI reply, make sure you copied all of it.
</details>

<details><summary>A file import shows only one column</summary>

Each line needs a front and a back separated by a comma, tab, or semicolon. Try opening the file and pasting its text into the paste box instead.
</details>

<details><summary>Accented letters look wrong (like Ã© instead of é)</summary>

Save the file as "CSV UTF-8" in Excel, or download it as CSV from Google Sheets, then import again.
</details>

<details><summary>A game says it needs more cards</summary>

Some games need at least 3 or 4 cards whose fronts and backs are all different. Add cards, or remove duplicates in **Options → Edit cards**.
</details>

<details><summary>Long cards look crowded in games</summary>

Games work best with fronts under about 60 characters and backs under about 150. Flash cards and the quiz handle longer text fine. See [Recommended limits](#recommended-limits).
</details>

<details><summary>The AI study guide shows an error</summary>

- **Key rejected:** copy the key again and check the provider matches the key (Gemini keys start with `AIza`).
- **Model name not found:** models get renamed or retired. Check your provider's model list and type a current name in the Model box.
- **Too many requests or out of credit:** wait a minute on the free tier, or check your provider account.
- **Couldn't reach the provider:** check your internet connection.
- **Google says the key isn't allowed for this API:** open the key in Google AI Studio and make sure it's limited to the Gemini (Generative Language) API.
- **Photos or PDFs ignored:** choose a model that can read images and files.
</details>

<details><summary>The text looks plain or different when I'm offline</summary>

SAGE's fonts load from the internet. Offline, it uses your computer's fonts, and everything still works.
</details>

## Recommended limits

SAGE was tested with very long cards and large decks. It won't break past these numbers, but this is where things work best.

| What | Recommended | Notes |
| --- | --- | --- |
| Front of a card | Up to about **60 characters** | Flash cards, the quiz, and the typing games handle much longer text. |
| Back of a card | Up to about **150 characters** | Up to about 500 is fine for flash cards and the quiz. |
| Answers in Blast and Scramble | Under about **40 characters** | These are printed on planets and rocks, so shorter reads best. Longer text shrinks to fit. |
| Cards per deck | Up to about **5,000** | 5,000 cards imported, searched, and edited instantly in testing. |
| All decks together | About **15,000 to 20,000** short cards | Browsers give each site roughly 5 MB of storage. A typical card uses about 220 bytes. |
| CSV file size | Under about **2 MB** | Split bigger files into several decks. |

## Browser support

Current versions of Chrome, Edge, Firefox, and Safari, on desktop and mobile. The typing games need a physical keyboard to be fun.

## For developers

**Customizing.** A few settings sit at the top of the script inside `sage.html`:

```js
const APP_NAME = 'SAGE';
const APP_VERSION = '1.0.0';
const GITHUB_URL = '';        // shows a GitHub link in the footer
const CRYPTO_WALLETS = [...]; // shows the Donate link and window
```

Leave a value empty to hide it.

**Hosting your own copy on GitHub Pages.** Rename or copy `sage.html` to `index.html` and enable Pages in the repository settings. Note that every project published under the same `your-name.github.io` address shares browser storage with the others, including saved API keys, so only host projects you trust there, or give SAGE its own custom domain.

**Releasing an update.** Bump `APP_VERSION`, note the changes in `CHANGELOG.md`, and attach `sage.html`, `sage.ico`, and `sage-icon.png` to a new GitHub Release. Saved data uses a versioned format, so new versions can upgrade old saves.

**Contributing.** Issues and pull requests are welcome. The whole app is one HTML file with plain HTML, CSS, and JavaScript and no build step. Each section of the script starts with a labeled comment header.

## How it was made

SAGE was designed and directed by Tobi Ward and built with the help of Claude, an AI assistant from Anthropic. Every feature, game, and design choice went through hands-on testing and revision. If you find a bug, please open an issue.

## License

[MIT](LICENSE) © 2026 Tobi Ward
