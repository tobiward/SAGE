/* ===================== Helpers ===================== */
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Study days run from 4 AM to 4 AM, so a late-night session still counts as the same day.
const studyDate = () => new Date(Date.now() - DAY_START_HOUR * 36e5);
const todayKey = () => { const d = studyDate(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
const endOfToday = () => { const d = studyDate(); d.setHours(23,59,59,999); return d.getTime() + DAY_START_HOUR * 36e5; };
const getDeck = id => db.decks.find(d => d.id === id);
function fmtInterval(ms){
  const m = ms / MIN;
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  const d = Math.round(ms / DAY);
  if (d < 31) return `${d}d`;
  if (d < 365) return `${(d / 30).toFixed(d < 300 ? 1 : 0).replace(/\.0$/, '')}mo`;
  return `${(d / 365).toFixed(1).replace(/\.0$/, '')}y`;
}
const fmtClock = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let toastTimer;
function toast(msg){
  let t = $('.toast'); if (!t){ t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role','status'); document.body.append(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600);
}
const newCard = (front, back) => ({ id: uid(), front, back, state: 'new', due: 0, s: 0, d: 0, reps: 0, lapses: 0, last: 0 });
function makeDeck(name){
  return { id: uid(), name, created: Date.now(), settings: { ...DEFAULTS }, today: { date: todayKey(), newCount: 0 }, cards: [] };
}
function refreshDaily(deck){ const t = todayKey(); if (!deck.today || deck.today.date !== t) deck.today = { date: t, newCount: 0, extraNew: 0 }; }
const newLeftToday = deck => Math.max(0, deck.settings.newPerDay + (deck.today.extraNew || 0) - deck.today.newCount);

