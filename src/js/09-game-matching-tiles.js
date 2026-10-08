/* ----- Game: Match ----- */
let m = null;
function stopMatchTimer(){ if (m && m.timer){ clearInterval(m.timer); m.timer = null; } }
function matchPick(deck, n){
  // Only use cards whose fronts and backs are all distinct, so no two tiles look alike.
  const seen = new Set(), out = [];
  for (const c of shuffle(deck.cards)){
    if (out.length >= n) break;
    const f = c.front.trim().toLowerCase(), b = c.back.trim().toLowerCase();
    if (!f || !b || f === b || seen.has(f) || seen.has(b)) continue;
    seen.add(f); seen.add(b); out.push(c);
  }
  return out;
}
GAMES.push({
  id: 'match', name: 'Matching Tiles', minCards: 2,
  desc: 'Pair each front with its back as fast as you can. Wrong pairs add 1 second.',
  usable: deck => matchPick(deck, Infinity),
  settings: [{ key: 'pairs', label: 'Pairs', default: 6, options: deck => {
    const max = Math.min(10, matchPick(deck, Infinity).length);
    return [...new Set([4, 6, 8, 10].filter(x => x <= max).concat(max < 4 ? [max] : []))].map(x => ({ value: x, label: `${x} pairs` }));
  } }],
  summary(deck){ return `${gameSetting(deck, this, 'pairs')} pairs`; },
  start(deck){
    const pairs = gameSetting(deck, this, 'pairs');
    const cards = matchPick(deck, pairs);
    const tiles = shuffle(cards.flatMap(c => [{ cid: c.id, text: c.front }, { cid: c.id, text: c.back }]));
    stopMatchTimer();
    m = { deckId: deck.id, pairs: cards.length, tiles, sel: null, matched: 0, penalty: 0, busy: false, start: Date.now(), timer: null };
    $('#matchDeck').textContent = deck.name;
    $('#matchGrid').innerHTML = tiles.map((t, i) =>     // each tile gets a random neon color (colors don't hint at pairs)
      `<button class="tile n${Math.floor(Math.random() * 4)}${t.text.length > 60 ? ' long' : ''}" data-tile="${i}">${esc(t.text)}</button>`).join('');
    const best = deck.games?.match?.best?.[String(cards.length)];
    $('#matchBest').textContent = best ? (best / 1000).toFixed(1) : '--';
    $('#matchPairs').textContent = `0/${cards.length}`; $('#matchClear').hidden = true;
    $('#matchTimer').textContent = '0.0';
    m.timer = setInterval(() => { $('#matchTimer').textContent = ((Date.now() - m.start + m.penalty) / 1000).toFixed(1); }, 100);
    show('match');
  }
});
$('#matchGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-tile]'); if (!btn || !m || m.busy) return;
  const i = +btn.dataset.tile, t = m.tiles[i]; if (t.done) return;
  const tileEl = k => $(`#matchGrid [data-tile="${k}"]`);
  if (m.sel === null){ m.sel = i; btn.classList.add('sel'); return; }
  if (m.sel === i){ btn.classList.remove('sel'); m.sel = null; return; }
  const a = m.tiles[m.sel], aEl = tileEl(m.sel);
  aEl.classList.remove('sel'); m.sel = null;
  if (a.cid === t.cid){
    a.done = t.done = true;
    for (const el of [aEl, btn]){ el.classList.add('gone'); el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1; }
    $('#matchPairs').textContent = `${m.matched + 1}/${m.pairs}`;
    if (++m.matched === m.pairs) finishMatch();
  } else {
    m.penalty += 1000; m.busy = true;
    aEl.classList.add('wrong'); btn.classList.add('wrong'); $('#matchPenalty').classList.add('show');
    setTimeout(() => { aEl.classList.remove('wrong'); btn.classList.remove('wrong'); $('#matchPenalty').classList.remove('show'); if (m) m.busy = false; }, 450);
  }
});
function finishMatch(){
  stopMatchTimer();
  $('#matchClear').hidden = false;                     // flash "CLEAR!" before the results
  const done = m; m = null;
  done.total = Date.now() - done.start + done.penalty;   // stop the clock now, not after the flash
  setTimeout(() => { if (!$('#view-match').hidden) finishMatchResults(done); }, 800);
}
function finishMatchResults(m){
  const total = m.total, deck = getDeck(m.deckId);
  const best = deck.games.match.best, key = String(m.pairs), prev = best[key];
  const isBest = !prev || total < prev;
  if (isBest){ best[key] = total; save(); }
  const mistakes = m.penalty / 1000;
  showResults({
    title: isBest && prev ? 'New best time!' : 'All matched',
    msg: isBest && prev ? `<span class="new-best">You beat your old record of ${fmtTime(prev)}.</span>`
       : isBest ? `That's your first time for ${m.pairs} pairs. Play again to beat it.`
       : `Your best for ${m.pairs} pairs is ${fmtTime(prev)}.`,
    stats: [['Time', fmtTime(total)], ['Pairs', String(m.pairs)], ['Wrong picks', String(mistakes)]]
  });
}
$('#matchQuit').onclick = () => { stopMatchTimer(); m = null; openGames(gameDeckId); };

