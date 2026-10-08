/* ===================== Storage ===================== */
// Everything loaded from storage or a backup file passes through cleanDb(), so a damaged or hand-edited
// file can't break the app or slip markup into the page: ids are forced to letters and digits,
// text is forced to strings, and numbers to safe ranges.
const cNum = (v, def = 0, lo = -Infinity, hi = Infinity) => { const n = +v; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
const cStr = (v, max = 20000) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '').slice(0, max);
const cId = v => typeof v === 'string' && /^[a-z0-9]{4,40}$/i.test(v) ? v : uid();
const cPlain = v => { try { return v && typeof v === 'object' && !Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : undefined; } catch { return undefined; } };
function cleanCard(c){
  if (!c || typeof c !== 'object') return null;
  const state = ['new', 'learning', 'review', 'relearning'].includes(c.state) ? c.state : 'new';
  const out = { id: cId(c.id), front: cStr(c.front), back: cStr(c.back), state, due: cNum(c.due), s: cNum(c.s, 0, 0, 1e6),
                d: cNum(c.d, 0, 0, 10), reps: cNum(c.reps, 0, 0), lapses: cNum(c.lapses, 0, 0), last: cNum(c.last) };
  if (state !== 'new' && !(out.s > 0)) Object.assign(out, { state: 'new', due: 0, s: 0, d: 0 });   // unusable schedule: start over
  if (Array.isArray(c.cols)) out.cols = c.cols.slice(0, 50).map(x => cStr(x));
  if (c.edited) out.edited = true;
  return out;
}
function cleanDeck(d){
  if (!d || typeof d !== 'object') return null;
  const seen = new Set();
  const cards = (Array.isArray(d.cards) ? d.cards : []).map(cleanCard).filter(Boolean)
    .map(c => { if (seen.has(c.id)) c.id = uid(); seen.add(c.id); return c; });
  const st = d.settings || {};
  const out = { id: cId(d.id), name: cStr(d.name, 200).trim() || 'Untitled deck', created: cNum(d.created, Date.now()),
    settings: { newPerDay: Math.round(cNum(st.newPerDay, DEFAULTS.newPerDay, 0, 9999)), sessionSize: Math.round(cNum(st.sessionSize, DEFAULTS.sessionSize, 1, 9999)),
                retention: cNum(st.retention, DEFAULTS.retention, 0.7, 0.97) },
    today: { date: cStr(d.today?.date, 20), newCount: cNum(d.today?.newCount, 0, 0), extraNew: cNum(d.today?.extraNew, 0, 0) }, cards };
  const games = cPlain(d.games);
  if (games){                       // keep game settings, but only numeric best scores
    for (const g of Object.values(games)) if (g && typeof g === 'object'){
      const best = g.best && typeof g.best === 'object' ? g.best : {};
      g.best = Object.fromEntries(Object.entries(best).filter(([, v]) => Number.isFinite(v)));
    }
    out.games = games;
  }
  const quiz = cPlain(d.quiz);
  if (quiz){ if (quiz.last && !Number.isFinite(quiz.last.pct)) delete quiz.last; out.quiz = quiz; }
  if (Array.isArray(d.columns) && d.columns.length){
    out.columns = d.columns.slice(0, 50).map(x => cStr(x, 200));
    const ok = a => (Array.isArray(a) ? a : []).filter(k => Number.isInteger(k) && k >= 0 && k < out.columns.length);
    out.layout = { front: ok(d.layout?.front), back: ok(d.layout?.back) };
    if (!out.layout.front.length) out.layout.front = [0];
    if (!out.layout.back.length) out.layout.back = [Math.min(1, out.columns.length - 1)];
  }
  return out;
}
function cleanDb(data){
  const seen = new Set();
  const decks = (Array.isArray(data?.decks) ? data.decks : []).map(cleanDeck).filter(Boolean)
    .map(d => { if (seen.has(d.id)) d.id = uid(); seen.add(d.id); return d; });
  return { version: 1, renamedScramble: !!data?.renamedScramble, decks };
}

let db = { version: 1, decks: [] };
let storageOK = true;
function load(){
  try {
    localStorage.setItem(STORE_KEY + '-test', '1'); localStorage.removeItem(STORE_KEY + '-test');
    const raw = localStorage.getItem(STORE_KEY);
    if (raw){
      try { db = cleanDb(JSON.parse(raw)); }
      catch {                     // damaged save: keep a copy instead of losing it, then start fresh
        try { localStorage.setItem(STORE_KEY + '-damaged-' + Date.now(), raw); } catch {}
        db = { version: 1, renamedScramble: true, decks: [] };
        setTimeout(() => toast('Your saved data was damaged and could not be read. Restore a backup to get your decks back.'), 500);
      }
    } else db.renamedScramble = true;     // brand-new install: nothing to migrate
    if (!db.renamedScramble){   // the falling-answers game used to be called Blast
      for (const d of db.decks) if (d.games?.blast){ d.games.scramble = d.games.blast; delete d.games.blast; }
      db.renamedScramble = true;
    }
    for (const d of db.decks){ const mg = d.games?.match; if (mg && mg.lastPairs && mg.pairs == null) mg.pairs = mg.lastPairs; }
  } catch(e){ storageOK = false; }
  $('#storageWarn').hidden = storageOK;
}
function save(){
  if (!storageOK) return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch(e){ toast('Could not save. Browser storage may be full.'); }
  afterSave();                                   // data safety: autosave file, backup reminder, storage protection
}

