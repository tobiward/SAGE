/* ----- Game: Circuit ----- */
const CIRCUIT_PENALTY = 2000;
const WIRE_COLORS = ['#E53935', '#1E88E5', '#FDD835', '#43A047', '#FB8C00', '#F5F5F5', '#AB47BC', '#8D6E63', '#00ACC1', '#EC407A'];
let cg = null;
function stopCircuit(){ if (cg){ cg.alive = false; clearInterval(cg.timer); cg = null; } }
GAMES.push({
  id: 'circuit', name: 'Matching Pairs', minCards: 3,
  desc: 'Connect each item on the left to its match on the right as fast as you can. Wrong connections add 2 seconds.',
  usable: deck => matchPick(deck, Infinity),
  settings: [
    { key: 'dir', label: 'Left side', default: 'front',
      options: () => [{ value: 'front', label: 'Front of card' }, { value: 'back', label: 'Back of card' }] },
    { key: 'pairs', label: 'Pairs', default: 6, options: deck => {
      const max = Math.min(8, matchPick(deck, Infinity).length);
      return [...new Set([4, 5, 6, 7, 8].filter(x => x <= max).concat(max < 4 ? [max] : []))].map(x => ({ value: x, label: `${x} pairs` }));
    } }],
  summary(deck){ return `${gameSetting(deck, this, 'pairs')} pairs, ${gameSetting(deck, this, 'dir') === 'front' ? 'fronts' : 'backs'} on the left`; },
  start(deck){
    const dir = gameSetting(deck, this, 'dir'), pairs = gameSetting(deck, this, 'pairs');
    const cards = matchPick(deck, pairs);
    const lt = c => dir === 'front' ? c.front : c.back, rt = c => dir === 'front' ? c.back : c.front;
    stopCircuit(); show('circuit');
    cg = { deckId: deck.id, pairs: cards.length, left: shuffle(cards).map(c => ({ cid: c.id, text: lt(c), card: c })),
           right: shuffle(cards).map(c => ({ cid: c.id, text: rt(c) })), wires: [], connected: 0, wrong: 0, penalty: 0,
           elapsed: 0, tickAt: performance.now(), sel: null, drag: null, missed: new Map(),
           alive: true, paused: false, phase: 'play', queued: [], last: 0 };
    const nodeHtml = (side, list) => list.map((n, i) => `<button class="node ${side}" data-side="${side}" data-i="${i}">
        <span class="node-text">${esc(n.text)}</span>
        <span class="terminal"></span><span class="stub"></span><i class="spark" style="animation-delay:${(Math.random() * 1.8).toFixed(2)}s"></i></button>`).join('');
    $('#circuitLeft').innerHTML = nodeHtml('L', cg.left);
    $('#circuitRight').innerHTML = nodeHtml('R', cg.right);
    $('#circuitTitle').textContent = deck.name;
    $('#circuitWireGroup').innerHTML = ''; $('#circuitLive').setAttribute('d', '');
    $('#circuitCap').classList.remove('full');
    $('#circuitPaused').hidden = true; $('#circuitPause').textContent = 'Pause';
    circuitCharge();
    cg.timer = setInterval(() => {
      if (!cg) return;
      const now = performance.now();
      if (!cg.paused && cg.phase === 'play') cg.elapsed += now - cg.tickAt;
      cg.tickAt = now;
      $('#circuitTime').textContent = ((cg.elapsed + cg.penalty) / 1000).toFixed(1);
    }, 100);
  }
});
const circuitNode = (side, i) => $(`#circuitBoard .node[data-side="${side}"][data-i="${i}"]`);
function circuitCharge(){
  const pct = cg.pairs ? cg.connected / cg.pairs * 100 : 0;
  $('#circuitFill').style.height = pct + '%';
  $('#circuitCharge').textContent = Math.round(pct) + '%';
  $('#circuitPairs').textContent = `${cg.connected}/${cg.pairs}`;
}
function circuitPoints(){
  const b = $('#circuitBoard').getBoundingClientRect(), cap = $('#circuitCap').getBoundingClientRect();
  const term = (side, i) => { const t = circuitNode(side, i).querySelector('.terminal').getBoundingClientRect();
    return { x: t.left + t.width / 2 - b.left, y: t.top + t.height / 2 - b.top }; };
  return { b, term, capL: cap.left - b.left + 3, capR: cap.right - b.left - 3 };
}
const wirePath = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  return `M${x1} ${y1} C${x1 + dx * 0.45} ${y1 + 14},${x2 - dx * 0.45} ${y2 + 14},${x2} ${y2}`;
};
function circuitDraw(){
  if (!cg) return;
  const { term, capL, capR } = circuitPoints();
  $('#circuitWireGroup').innerHTML = cg.wires.map(w => {
    const a = term('L', w.li), c = term('R', w.ri);
    return `<path class="wire" stroke="${w.color}" style="filter:drop-shadow(0 0 3px ${w.color})" d="${wirePath(a.x, a.y, capL, a.y)}"/>
      <path class="wire" stroke="${w.color}" style="filter:drop-shadow(0 0 3px ${w.color})" d="${wirePath(capR, c.y, c.x, c.y)}"/>
      <circle class="solder" cx="${capL}" cy="${a.y}" r="4"/><circle class="solder" cx="${capR}" cy="${c.y}" r="4"/>`;
  }).join('');
}
new ResizeObserver(() => circuitDraw()).observe($('#circuitBoard'));
function circuitSelect(side, i){
  document.querySelectorAll('#circuitBoard .node.sel').forEach(n => n.classList.remove('sel'));
  cg.sel = side ? { side, i } : null;
  if (side) circuitNode(side, i).classList.add('sel');
}
function circuitAttempt(li, ri){
  const L = cg.left[li], R = cg.right[ri], ln = circuitNode('L', li), rn = circuitNode('R', ri);
  if (L.cid === R.cid){
    const color = WIRE_COLORS[cg.connected % WIRE_COLORS.length];
    cg.wires.push({ li, ri, color }); cg.connected++;
    for (const n of [ln, rn]){ n.classList.add('done'); n.style.setProperty('--wire', color); n.setAttribute('aria-disabled', 'true'); }
    circuitDraw(); circuitCharge();
    if (cg.connected === cg.pairs) circuitFinish();
  } else {
    cg.wrong++; cg.penalty += CIRCUIT_PENALTY; cg.missed.set(L.cid, L.card);
    const { term } = circuitPoints(), a = term('L', li), c = term('R', ri);
    const bad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    bad.setAttribute('class', 'bad-wire'); bad.setAttribute('d', wirePath(a.x, a.y, c.x, c.y));
    $('#circuitWires').append(bad); setTimeout(() => bad.remove(), 350);
    for (const n of [ln, rn]){ n.classList.add('zap'); setTimeout(() => n.classList.remove('zap'), 400); }
    const p = $('#circuitPenalty'); p.textContent = `+${CIRCUIT_PENALTY / 1000}s`; p.classList.add('show');
    clearTimeout(p._t); p._t = setTimeout(() => p.classList.remove('show'), 700);
  }
}
function circuitTap(side, i){
  if (cg.sel && cg.sel.side !== side){
    const s = cg.sel; circuitSelect(null);
    return s.side === 'L' ? circuitAttempt(s.i, i) : circuitAttempt(i, s.i);
  }
  if (cg.sel && cg.sel.side === side && cg.sel.i === i) return circuitSelect(null);
  circuitSelect(side, i);
}
const circuitReady = () => cg && !cg.paused && cg.phase === 'play';
$('#circuitBoard').addEventListener('pointerdown', e => {
  if (!circuitReady()) return;
  const n = e.target.closest('.node'); if (!n || n.classList.contains('done')) return;
  e.preventDefault();
  cg.drag = { side: n.dataset.side, i: +n.dataset.i, x: e.clientX, y: e.clientY, moved: false };
  n.classList.add('active');
});
window.addEventListener('pointermove', e => {
  if (!cg || !cg.drag) return;
  const d = cg.drag;
  if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
  if (!d.moved) return;
  const { b, term } = circuitPoints(), a = term(d.side, d.i);
  $('#circuitLive').setAttribute('d', wirePath(a.x, a.y, e.clientX - b.left, e.clientY - b.top));
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('#circuitBoard .node');
  document.querySelectorAll('#circuitBoard .node.target').forEach(x => { if (x !== over) x.classList.remove('target'); });
  if (over && over.dataset.side !== d.side && !over.classList.contains('done')) over.classList.add('target');
});
window.addEventListener('pointerup', e => {
  if (!cg || !cg.drag) return;
  const d = cg.drag; cg.drag = null;
  $('#circuitLive').setAttribute('d', '');
  document.querySelectorAll('#circuitBoard .node.active, #circuitBoard .node.target').forEach(x => x.classList.remove('active', 'target'));
  if (!circuitReady()) return;
  if (!d.moved) return circuitTap(d.side, d.i);
  const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('#circuitBoard .node');
  circuitSelect(null);
  if (t && t.dataset.side !== d.side && !t.classList.contains('done')){
    d.side === 'L' ? circuitAttempt(d.i, +t.dataset.i) : circuitAttempt(+t.dataset.i, d.i);
  }
});
$('#circuitBoard').addEventListener('keydown', e => {      // keyboard: Tab to a node, Enter or Space to select
  if (!(e.key === 'Enter' || e.key === ' ') || !circuitReady()) return;
  const n = e.target.closest('.node'); if (!n || n.classList.contains('done')) return;
  e.preventDefault(); circuitTap(n.dataset.side, +n.dataset.i);
});
function circuitFinish(){
  cg.phase = 'over';
  const total = cg.elapsed + cg.penalty;
  $('#circuitTime').textContent = (total / 1000).toFixed(1);
  $('#circuitCap').classList.add('full');
  later(cg, () => {
    const g = cg, deck = getDeck(g.deckId), store = gameStore(deck, 'circuit');
    const key = String(g.pairs), prev = store.best[key], isBest = !prev || total < prev;
    if (isBest){ store.best[key] = total; save(); }
    const missed = [...g.missed.values()].slice(0, 10);
    const list = missed.length ? `<br><br>Cards worth reviewing:<ul class="review-list">${missed.map(c => `<li>${esc(c.front)}: ${esc(c.back)}</li>`).join('')}</ul>` : '';
    showResults({
      title: isBest && prev ? 'New best time!' : 'Fully charged',
      msg: (isBest && prev ? `<span class="new-best">You beat your old record of ${fmtTime(prev)}.</span>`
          : isBest ? `That's your first time for ${g.pairs} pairs. Play again to beat it.`
          : `Your best for ${g.pairs} pairs is ${fmtTime(prev)}.`) + list,
      stats: [['Time', fmtTime(total)], ['Pairs', String(g.pairs)], ['Wrong connections', String(g.wrong)]]
    });
  }, 900);
}
$('#circuitPause').onclick = () => cg && setPaused(cg, !cg.paused, 'circuit');
$('#circuitQuit').onclick = () => { stopCircuit(); openGames(gameDeckId); };

