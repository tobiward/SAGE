/* ===================== Views ===================== */
const WIDE_VIEWS = ['help', 'ai', 'games', 'match', 'scramble', 'blast', 'circuit', 'terminal', 'lightning', 'results', 'quiz', 'quizsetup', 'edit'];
function show(view){
  document.body.classList.toggle('wide', WIDE_VIEWS.includes(view));
  if (view !== 'edit' && ed) edClose();
  if (view !== 'match') stopMatchTimer();
  if (view !== 'scramble') stopScramble();
  if (view !== 'blast') stopBlast();
  if (view !== 'circuit') stopCircuit();
  if (view !== 'terminal') stopTerminal();
  if (view !== 'lightning') stopLightning();
  // Every <section id="view-..."> is a screen; show the requested one and hide the rest.
  for (const el of document.querySelectorAll('main > section[id^="view-"]')) el.hidden = el.id !== 'view-' + view;
  window.scrollTo(0, 0);
}
function deckCounts(deck){
  refreshDaily(deck);
  const eod = endOfToday(); let nw = 0, lrn = 0, rev = 0;
  for (const c of deck.cards){
    if (c.state === 'new') nw++;
    else if (c.state === 'review'){ if (c.due <= eod) rev++; }
    else lrn++;
  }
  const newAvail = Math.min(nw, newLeftToday(deck));
  return { nw: newAvail, lrn, rev };
}
const countSpan = (n, cls) => `<span class="${n ? cls : 'c-zero'}">${n}</span>`;

function renderHome(){
  renderBackupNudge();
  const list = $('#deckList');
  $('#deckWrap').hidden = !db.decks.length;
  $('#emptyState').hidden = !!db.decks.length;
  list.innerHTML = db.decks.map(d => {
    const c = deckCounts(d); const any = c.nw + c.lrn + c.rev;
    return `<li class="deck">
      <div><div class="deck-name">${esc(d.name)}</div><div class="deck-sub">${d.cards.length} card${d.cards.length === 1 ? '' : 's'}${any ? '' : ' · done for today'}</div></div>
      <div class="counts labeled">${[[c.nw, 'c-new', 'New'], [c.lrn, 'c-lrn', 'Learning'], [c.rev, 'c-rev', 'Due']]
        .map(([n, cls, label]) => `<span class="cnt"><b class="${n ? cls : 'c-zero'}">${n}</b><small>${label}</small></span>`).join('')}</div>
      <div class="deck-actions">
        <button class="btn primary" data-study="${d.id}">Flash cards</button>
        <button class="btn" data-quiz="${d.id}">Quiz</button>
        <button class="btn" data-games="${d.id}">Games</button>
        <button class="btn" data-opts="${d.id}">Options</button>
      </div></li>`;
  }).join('');
  show('home');
}

