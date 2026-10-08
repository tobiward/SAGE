/* ===================== Games framework =====================
   Each game is an object in GAMES with:
     id, name, desc       shown in the games menu
     minCards             fewest usable cards the game needs
     usable(deck)         cards the game can use
     settings             [{ key, label, default, hint?, options(deck) -> [{ value, label }] }]
                          shown on the Settings tab and saved per deck
     summary(deck)        one line describing the current settings, shown under the game
     start(deck)          begins the game; call showResults() when it ends
   Games never change the study schedule. */
const GAMES = [];
let gameDeckId = null, lastGameId = null;
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function fmtTime(ms){ const s = ms / 1000; return s < 60 ? s.toFixed(1) + 's' : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; }
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const PROMPT_SETTING = { key: 'dir', label: 'Prompt', default: 'front',
  options: () => [{ value: 'front', label: 'Front of card' }, { value: 'back', label: 'Back of card' }] };
const promptLabel = dir => dir === 'front' ? 'Front prompt' : 'Back prompt';
const livesText = n => n ? plural(n, 'life').replace('lifes', 'lives') : 'unlimited lives';

function gameStore(deck, id){ deck.games = deck.games || {}; return deck.games[id] = deck.games[id] || { best: {} }; }
function gameSetting(deck, g, key){
  const def = g.settings.find(x => x.key === key), opts = def.options(deck);
  const saved = deck.games?.[g.id]?.[key];
  const hit = opts.find(o => String(o.value) === String(saved));
  if (hit) return hit.value;
  return (opts.find(o => String(o.value) === String(def.default)) || opts[opts.length - 1] || {}).value;
}
const gameReady = (deck, g) => g.usable(deck).length >= g.minCards;

function openGames(deckId, tab){
  const deck = getDeck(deckId); if (!deck) return renderHome();
  gameDeckId = deckId;
  $('#gamesTitle').textContent = `Games: ${deck.name}`;
  renderGameList(deck); renderGameSettings(deck); setGamesTab(tab || 'play');
  show('games');
}
function renderGameList(deck){
  $('#gameList').innerHTML = GAMES.map(g => {
    const ok = gameReady(deck, g);
    return `<li class="game">
      <div><div class="deck-name">${esc(g.name)}</div>
        <div class="deck-sub">${ok ? esc(g.desc) : `Needs at least ${g.minCards} cards with a front and back that are all different.`}</div>
        ${ok ? `<div class="game-summary">${esc(g.summary(deck))}</div>` : ''}</div>
      <button class="btn primary" data-play="${g.id}" ${ok ? '' : 'disabled'}>Play</button></li>`;
  }).join('');
}
function renderGameSettings(deck){
  $('#gameSettings').innerHTML = GAMES.map(g => {
    if (!gameReady(deck, g)) return `<section class="setting-group"><h2>${esc(g.name)}</h2><p class="hint">Add more cards to this deck to play ${esc(g.name)}.</p></section>`;
    return `<section class="setting-group"><h2>${esc(g.name)}</h2><div class="setting-row">${g.settings.map(st => {
      const cur = String(gameSetting(deck, g, st.key));
      return `<label class="field">${esc(st.label)}
        <select data-game="${g.id}" data-key="${st.key}">${st.options(deck).map(o =>
          `<option value="${esc(String(o.value))}" ${String(o.value) === cur ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
        ${st.hint ? `<span class="hint">${esc(st.hint)}</span>` : ''}</label>`;
    }).join('')}</div></section>`;
  }).join('');
}
$('#gameSettings').addEventListener('change', e => {
  const sel = e.target.closest('select[data-game]'); if (!sel) return;
  const deck = getDeck(gameDeckId), g = GAMES.find(x => x.id === sel.dataset.game), st = g.settings.find(x => x.key === sel.dataset.key);
  const opt = st.options(deck).find(o => String(o.value) === sel.value);
  gameStore(deck, g.id)[st.key] = opt ? opt.value : sel.value;
  save(); renderGameList(deck); toast('Setting saved');
});
function setGamesTab(tab){
  for (const [t, panel] of [['play', '#gamesPlay'], ['settings', '#gamesSettings']]){
    const on = t === tab, btn = $(`#tab-${t}`);
    btn.classList.toggle('on', on); btn.setAttribute('aria-selected', String(on)); $(panel).hidden = !on;
  }
}
$('#tab-play').onclick = () => setGamesTab('play');
$('#tab-settings').onclick = () => setGamesTab('settings');
function playGame(id){
  const g = GAMES.find(x => x.id === id), deck = getDeck(gameDeckId);
  if (!g || !deck) return;
  lastGameId = id; gameStore(deck, id); g.start(deck);
}
function showResults({ title, msg, stats }){
  $('#resTitle').textContent = title;
  $('#resMsg').innerHTML = msg || '';
  $('#resStats').innerHTML = (stats || []).map(([label, value]) => `<div><b>${esc(value)}</b>${esc(label)}</div>`).join('');
  show('results'); $('#resAgain').focus({ preventScroll: true });
}
$('#resBack').onclick = () => openGames(gameDeckId);
$('#resAgain').onclick = () => lastGameId && playGame(lastGameId);

