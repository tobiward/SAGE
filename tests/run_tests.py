#!/usr/bin/env python3
"""End-to-end tests for SAGE. They open the built sage.html in a real (headless) browser and use it like a person would.

Setup once:   pip install playwright && playwright install chromium
Run:          python build.py && python tests/run_tests.py
Optional:     pip install opencv-python-headless   (also checks that donate QR codes scan correctly)
"""
import json
import subprocess
import sys
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
APP = (ROOT / "sage.html").as_uri()
TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


def open_app(browser, viewport=(1280, 900)):
    page = browser.new_page(viewport={"width": viewport[0], "height": viewport[1]})
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.on("dialog", lambda d: (page.errors.append("unexpected dialog: " + d.message), d.dismiss()))
    page.goto(APP)
    return page


def sample_deck(page):
    page.click("#sampleBtn")


def no_errors(page):
    assert not page.errors, page.errors


# ---------------------------------------------------------------- build
@test
def build_is_up_to_date(browser):
    r = subprocess.run([sys.executable, str(ROOT / "build.py"), "--check"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr


# ---------------------------------------------------------------- every screen opens
@test
def every_screen_opens(browser):
    page = open_app(browser)
    sample_deck(page)
    for game in ["match", "scramble", "blast", "circuit", "terminal", "survival", "lightning"]:
        page.click(".deck [data-games]")
        page.click(f'[data-play="{game}"]')
        page.wait_for_timeout(500)
        page.click("#homeBtn")
    page.click(".deck [data-quiz]"); page.click("#qsStart"); page.click("#homeBtn")
    page.click(".deck [data-study]"); page.keyboard.press("Space"); page.keyboard.press("3"); page.click("#homeBtn")
    page.click(".deck [data-opts]"); page.click("#editCardsBtn"); page.click("#homeBtn")
    for btn in ["#helpBtn", "#aiBtn", "#importBtn"]:
        page.click(btn); page.click("#homeBtn")
    no_errors(page)


# ---------------------------------------------------------------- scheduler
@test
def good_answers_space_cards_further_apart(browser):
    page = open_app(browser)
    gaps = page.evaluate("""() => {
      let now = Date.now(), c = newCard('a', 'b'), out = [];
      c = previewAll(c, now, 0.9)[3]; now += 10 * 60e3; c = previewAll(c, now, 0.9)[3];
      for (let i = 0; i < 4; i++){ out.push(Math.round((c.due - now) / 864e5)); now = c.due; c = previewAll(c, now, 0.9)[3]; }
      return out; }""")
    assert all(b > a for a, b in zip(gaps, gaps[1:])), gaps
    no_errors(page)


# ---------------------------------------------------------------- pasting
PASTES = {
    "plain csv": "Front,Back\nMitochondria,Powerhouse of the cell\nOsmosis,Water across a membrane",
    "quoted with spaces": '"Front", "Back"\n"Mitochondria", "Powerhouse, of the cell"\n"Osmosis", "Water"',
    "fenced AI reply": "Sure!\n\n```csv\nFront,Back\nA,\"B, with comma\"\nC,D\n```\n\nGood luck, have fun.",
    "markdown table": "Here:\n\n| Term | Definition |\n|---|---|\n| **Mitochondria** | Powerhouse |\n| Osmosis | Water |\n\nMore?",
    "tab separated": "Term\tDefinition\nMitochondria\tPowerhouse\nOsmosis\tWater",
    "prose around csv": "Sure, here you go.\n\nFront,Back\nMitochondria,Powerhouse\nOsmosis,Water\n\nHope this helps, bye!",
    "colon list": "Key terms:\n1. **Mitochondria**: Powerhouse\n2. **Osmosis**: Water\n3. Diffusion: Spreading",
    "dash list": "- Mitochondria - Powerhouse\n- Osmosis \u2014 Water",
}


@test
def pasted_text_formats(browser):
    page = open_app(browser)
    for name, text in PASTES.items():
        rows = page.evaluate("t => parsePasted(t)", text)
        cards = [r for r in rows if r[0].lower() not in ("front", "term")]
        assert len(cards) >= 2 and all(len(r) >= 2 and r[0] and r[1] for r in cards), (name, rows)
    no_errors(page)


# ---------------------------------------------------------------- safety
EVIL = {"version": 1, "renamedScramble": True, "decks": [{
    "id": 'x" onmouseover="alert(1)', "name": "<img src=x onerror=alert(1)>Evil", "settings": {"newPerDay": "lots", "retention": 5},
    "games": {"match": {"best": {"6": "<b>"}}}, "quiz": {"last": {"pct": "<script>"}},
    "cards": [{"id": 'a"><svg onload=alert(1)>', "front": "<script>alert(1)</script>", "back": {"x": 1}, "state": "review", "s": "NaN"},
              {"id": "dup1", "front": "A", "back": "B"}, {"id": "dup1", "front": "C", "back": "D"}, None, 5]}]}


@test
def hostile_backup_is_cleaned(browser, tmp=ROOT / "tests" / ".evil-backup.json"):
    tmp.write_text(json.dumps(EVIL))
    try:
        page = open_app(browser)
        page.click("#backupBtn"); page.set_input_files("#restoreIn", str(tmp)); page.click("#confirmYes")
        page.wait_for_timeout(200)
        deck = page.evaluate("db.decks[0]")
        assert deck["id"].isalnum() and all(c["id"].isalnum() for c in deck["cards"])
        assert len({c["id"] for c in deck["cards"]}) == 3 and deck["cards"][0]["back"] == ""
        assert deck["settings"]["retention"] <= 0.97 and deck["games"]["match"]["best"] == {}
        page.hover(".deck"); page.click(".deck [data-study]")
        no_errors(page)                               # no alert() fired, nothing crashed
    finally:
        tmp.unlink(missing_ok=True)


@test
def damaged_save_is_kept_not_wiped(browser):
    page = open_app(browser)
    page.evaluate("localStorage.setItem(STORE_KEY, '{broken')"); page.reload(); page.wait_for_timeout(700)
    assert page.evaluate("Object.keys(localStorage).some(k => k.includes('damaged'))")
    assert page.evaluate("storageOK")


# ---------------------------------------------------------------- data safety
@test
def backup_reminder_appears_and_snoozes(browser):
    page = open_app(browser)
    sample_deck(page)
    assert page.is_hidden("#backupNudge")
    page.evaluate("prefs.firstUse = Date.now() - 8 * 864e5; savePrefs(); renderHome();")
    assert page.is_visible("#backupNudge")
    page.click("#nudgeLater"); assert page.is_hidden("#backupNudge")
    page.evaluate("prefs.snoozeUntil = 0; renderHome();")
    with page.expect_download():
        page.click("#nudgeAction")
    assert page.is_hidden("#backupNudge")
    no_errors(page)


FAKE_FILE_SYSTEM = """() => {
  window.__written = [];
  const handle = { name: 'SAGE decks.json',
    async createWritable(){ let buf = ''; return { async write(t){ buf += t; }, async close(){ window.__written.push(buf); } }; },
    async queryPermission(){ return 'granted'; }, async requestPermission(){ return 'granted'; } };
  window.showSaveFilePicker = async () => handle;
  window.showOpenFilePicker = async () => [handle];
}"""


@test
def autosave_to_file_keeps_file_current(browser):
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.errors = []; page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.add_init_script(f"({FAKE_FILE_SYSTEM})()")          # stand-in for the browser's save-file feature
    page.goto(APP)
    sample_deck(page)
    page.click("#backupBtn"); assert page.is_visible("#autoBox")
    page.click("#autoChoose"); page.wait_for_timeout(300)
    assert "Saving to" in page.inner_text("#autoStatus")
    page.keyboard.press("Escape")
    page.click(".deck [data-study]"); page.keyboard.press("Space"); page.keyboard.press("3")
    page.wait_for_timeout(2000)                             # autosave waits ~1.5 s after the last change
    latest = json.loads(page.evaluate("window.__written.at(-1)"))
    assert any(c["state"] != "new" for c in latest["decks"][0]["cards"]), "rating wasn't autosaved"
    page.click("#homeBtn"); page.evaluate("prefs.firstUse = Date.now() - 30 * 864e5; renderHome();")
    assert page.is_hidden("#backupNudge"), "no reminder needed while autosave is on"
    no_errors(page)


# ---------------------------------------------------------------- quiz, editor, AI
@test
def quiz_marks_missed_cards_hard(browser):
    page = open_app(browser)
    sample_deck(page)
    page.evaluate("db.decks[0].cards.forEach(c => { c.state='review'; c.s=10; c.d=5; c.last=Date.now()-864e5; c.due=Date.now()+10*864e5 }); save(); renderHome();")
    page.click("[data-quiz]"); page.select_option("#qsCount", "5"); page.click("#qsStart")
    for i, (right, n) in enumerate(page.evaluate("qz.qs.map(q => [q.right, q.options.length])")):
        page.click(f'.pq-opt[data-q="{i}"][data-o="{right if i else (right + 1) % n}"]')
    due_now = page.evaluate("db.decks[0].cards.filter(c => c.due <= Date.now()).map(c => c.d)")
    assert len(due_now) == 1 and due_now[0] > 5
    no_errors(page)


@test
def deck_editor_add_move_delete_undo(browser):
    page = open_app(browser)
    sample_deck(page)
    page.click("[data-opts]"); page.click("#editCardsBtn")
    first = page.evaluate("db.decks[0].cards[0].id")
    page.click('.ed-row:nth-child(1) [data-move="1"]'); assert page.evaluate("db.decks[0].cards[1].id") == first
    page.click(".ed-row:nth-child(1) [data-del]"); assert page.evaluate("db.decks[0].cards.length") == 9
    page.click("#edUndoBtn"); assert page.evaluate("db.decks[0].cards.length") == 10
    page.click("#edAdd"); page.keyboard.type("New front")
    page.click("#view-edit [data-act=home]")
    assert page.evaluate("db.decks[0].cards.at(-1).front") == "New front"
    no_errors(page)


@test
def ai_study_guide_with_mocked_gemini(browser):
    page = open_app(browser)
    reply = "Cards:\n```csv\nFront,Back\nA,B\nC,D\n```\nTips: review daily."
    page.route("https://generativelanguage.googleapis.com/**", lambda route: route.fulfill(
        status=200, content_type="application/json", headers={"access-control-allow-origin": "*"},
        body=json.dumps({"candidates": [{"content": {"parts": [{"text": reply}]}, "finishReason": "STOP"}]})))
    page.click("#aiBtn"); page.fill("#aiKey", "AIzaTEST"); page.fill("#aiText", "notes"); page.click("#aiRun")
    page.wait_for_timeout(400)
    assert page.inner_text("#aiImport") == "Import 2 cards", page.inner_text("#aiStatus")
    no_errors(page)


@test
def donate_qr_codes_scan(browser):
    try:
        import cv2
    except ImportError:
        return "skipped (opencv not installed)"
    page = open_app(browser, (1280, 1400))
    page.click("#donateLink")
    det, shot = cv2.QRCodeDetector(), ROOT / "tests" / ".qr.png"
    try:
        for i, addr in enumerate(page.evaluate("CRYPTO_WALLETS.filter(w => w.address).map(w => w.address)")):
            page.locator(".wallet-qr").nth(i).screenshot(path=str(shot))
            img = cv2.resize(cv2.imread(str(shot)), None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST)
            assert det.detectAndDecode(img)[0] == addr, addr
    finally:
        shot.unlink(missing_ok=True)
    no_errors(page)


# ---------------------------------------------------------------- fair questions
@test
def decoys_match_the_blank_and_hide_capitals(browser):
    page = open_app(browser)
    res = page.evaluate("""() => {
      const cards = [['A','Teams keep improving through feedback'], ['B','Planning prevents wasted effort'], ['C','Leaders encourage sharing knowledge'],
                     ['D','Automation reduces repetitive tasks'], ['E','Testing catches problems early']].map(([f, b]) => newCard(f, b));
      const decoys = pickDecoys('improving', false, 'back', cards[0], cards, cards[0].back);
      return { decoys, washed: washCase(['Teams', 'planning', 'effort', 'knowledge']), same: washCase(['Paris', 'Oslo']) };
    }""")
    assert all(d.endswith("ing") for d in res["decoys"]), res
    assert res["washed"] == ["teams", "planning", "effort", "knowledge"] and res["same"] == ["Paris", "Oslo"], res
    no_errors(page)


# ---------------------------------------------------------------- typing games
def start_game(page, game, deck_js=None):
    if deck_js:
        page.evaluate(deck_js)
    else:
        sample_deck(page)
    page.click(".deck [data-games]"); page.click(f'[data-play="{game}"]'); page.wait_for_timeout(200)


ITIL = """() => { const d = makeDeck('ITIL'); [
  ['Focus on value','Everything the organization does should link back to value for stakeholders'],
  ['Start where you are','Reuse what already works instead of starting from scratch'],
  ['Progress iteratively with feedback','Work in small steps and gather feedback after each one'],
  ['Keep it simple and practical','Use the fewest steps needed and remove anything that adds no value']]
  .forEach(([f, b]) => d.cards.push(newCard(f, b))); db.decks.push(d); save(); renderHome(); }"""


@test
def terminal_hides_wrong_letters_until_clear_and_rewards_words(browser):
    page = open_app(browser)
    start_game(page, "terminal", ITIL)
    t, gs, ans = page.evaluate("[tg.target, tg.gap.start, tg.answer]")
    page.keyboard.type(t[:gs] + "zz", delay=5)
    assert page.locator("#termLine .gapbox .bad").count() == 0, "red letters shown too early"
    page.keyboard.type("zzz", delay=5)                       # now 5 letters: verdict shows
    assert page.locator("#termLine .gapbox .bad").count() > 0
    for _ in range(5): page.keyboard.press("Backspace")
    page.keyboard.type(t[gs:], delay=3)
    assert page.evaluate("tg.done") == 1
    assert page.evaluate("tg.bonus") == 1000 * len(t.split()), page.evaluate("[tg.bonus, tg.wordsTyped]")
    no_errors(page)


@test
def survival_hint_button_works_without_tab(browser):
    page = open_app(browser, (390, 844))
    start_game(page, "survival", ITIL)
    page.click("#termHintBtn")
    assert page.evaluate("[tg.lives, tg.hintN]") == [2, 1]
    no_errors(page)


@test
def lightning_time_rewards(browser):
    page = open_app(browser)
    start_game(page, "lightning")
    t0 = page.evaluate("lt.timeLeft"); page.evaluate("ltAnswer(lt.truth)")
    assert page.evaluate("lt.timeLeft") > t0 + 4.5
    page.wait_for_timeout(400); t1 = page.evaluate("lt.timeLeft"); page.evaluate("ltAnswer(!lt.truth)")
    assert page.evaluate("lt.timeLeft") < t1 - 4.5
    page.wait_for_timeout(800); page.evaluate("lt.elapsed = 301"); t2 = page.evaluate("lt.timeLeft"); page.evaluate("ltAnswer(lt.truth)")
    assert 2.5 < page.evaluate("lt.timeLeft") - t2 < 3.5
    no_errors(page)


# ---------------------------------------------------------------- phones
LONG = """() => { const d = makeDeck('Long'); for (let i = 0; i < 6; i++) d.cards.push(newCard('Term number ' + i + ' with a fairly long name',
  'A rather long answer that goes on for quite a while, number ' + i + ', so it cannot fit on a small rock or planet')); db.decks.push(d); save(); renderHome(); }"""


@test
def long_answers_on_a_phone(browser):
    page = open_app(browser, (390, 844))
    start_game(page, "scramble", LONG)
    page.wait_for_timeout(300)
    heights = page.evaluate("bl.rocks.map(r => r.el.offsetHeight)")
    assert max(heights) <= 110, heights
    page.click("#scrambleQuit"); page.click("#gameList [data-play=blast]"); page.wait_for_timeout(600)
    assert page.evaluate("getComputedStyle(document.querySelector('.astro')).overflow") == "visible"
    no_errors(page)


# ---------------------------------------------------------------- AI busy handling
@test
def ai_retries_and_falls_back_when_busy(browser):
    page = open_app(browser)
    calls = []
    ok = json.dumps({"candidates": [{"content": {"parts": [{"text": "```csv\nFront,Back\nA,B\nC,D\n```"}]}, "finishReason": "STOP"}]})
    def handle(route):
        model = route.request.url.split("/models/")[1].split(":")[0]
        calls.append(model)
        busy = model == "gemini-3.5-flash-lite"              # pretend the default model is overloaded
        route.fulfill(status=503 if busy else 200, content_type="application/json", headers={"access-control-allow-origin": "*"},
                      body=json.dumps({"error": {"message": "overloaded"}}) if busy else ok)
    page.route("https://generativelanguage.googleapis.com/**", handle)
    page.click("#aiBtn"); page.fill("#aiKey", "AIzaTEST"); page.fill("#aiText", "notes"); page.click("#aiRun")
    for _ in range(100):                                     # retries wait a few seconds (the page's security policy blocks wait_for_function)
        if page.inner_text("#aiStatus").startswith("Done"): break
        page.wait_for_timeout(200)
    assert calls[:3] == ["gemini-3.5-flash-lite"] * 3 and calls[3] == "gemini-3.5-flash", calls
    assert "gemini-3.5-flash" in page.inner_text("#aiStatus")
    assert page.inner_text("#aiImport") == "Import 2 cards"
    no_errors(page)


def main():
    failed = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for fn in TESTS:
            try:
                note = fn(browser)
                print(f"  ok    {fn.__name__}" + (f"  ({note})" if note else ""))
            except Exception:
                failed += 1
                print(f"  FAIL  {fn.__name__}\n" + "".join("        " + l for l in traceback.format_exc().splitlines(True)))
        browser.close()
    print(f"\n{len(TESTS) - failed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
