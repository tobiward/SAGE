/* ===================== Study session ===================== */
let ses = null;
function interleave(a, b){
  if (!a.length) return b.slice(); if (!b.length) return a.slice();
  const out = []; let i = 0, j = 0;
  while (i < a.length || j < b.length){
    if (j >= b.length || (i < a.length && (i + 1) / a.length <= (j + 1) / b.length)) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return out;
}
function startStudy(deckId){
  const deck = getDeck(deckId); refreshDaily(deck);
  const eod = endOfToday(); let slots = deck.settings.sessionSize;
  const lrn = deck.cards.filter(c => c.state === 'learning' || c.state === 'relearning').sort((a,b) => a.due - b.due).slice(0, slots);
  slots -= lrn.length;
  const rev = deck.cards.filter(c => c.state === 'review' && c.due <= eod).sort((a,b) => a.due - b.due).slice(0, slots);
  slots -= rev.length;
  const newLeft = newLeftToday(deck);
  const nw = deck.cards.filter(c => c.state === 'new').slice(0, Math.min(newLeft, slots));
  if (!lrn.length && !rev.length && !nw.length){ save(); return openStudyMore(deckId); }
  beginSession(deck, 'normal', interleave(rev, nw).map(c => c.id), lrn.map(c => c.id));
}
function beginSession(deck, mode, queue, pending){
  ses = { deckId: deck.id, mode, queue, pending, current: null, stats: {1:0,2:0,3:0,4:0}, reviewed: 0 };
  lastDeckId = deck.id;
  $('#studyDeck').textContent = deck.name + (mode === 'practice' ? ' (practice)' : mode === 'ahead' ? ' (reviewing ahead)' : '');
  show('study'); nextCard();
}

/* ----- Study more: extra new cards, review ahead, free practice ----- */
let lastDeckId = null, moreDeckId = null;
function openStudyMore(deckId){
  const deck = getDeck(deckId); moreDeckId = deckId; refreshDaily(deck);
  const newTotal = deck.cards.filter(c => c.state === 'new').length;
  const aheadTotal = deck.cards.filter(c => c.state === 'review').length;
  const c = deckCounts(deck);
  $('#moreMsg').textContent = (c.nw + c.lrn + c.rev) ? `"${deck.name}" still has cards due. These options are for going beyond them.` : `You've finished today's cards in "${deck.name}".`;
  $('#moreNewHint').textContent = newTotal ? `Raise today's new card limit. ${newTotal} unseen card${newTotal === 1 ? '' : 's'} left.` : 'Every card in this deck has been seen.';
  $('#moreAheadHint').textContent = aheadTotal ? 'Review cards before they are due, soonest first. The schedule still updates, but early reviews grow intervals less.' : 'No cards are in review yet.';
  const opts = { new: newTotal, ahead: aheadTotal, practice: deck.cards.length };
  let pick = null;
  for (const r of document.querySelectorAll('input[name=more]')){
    r.disabled = !opts[r.value]; r.closest('label').style.opacity = r.disabled ? .5 : 1;
    r.checked = false; if (!pick && !r.disabled) pick = r;
  }
  if (pick) pick.checked = true;
  $('#moreStart').disabled = !pick;
  $('#moreCount').value = Math.min(20, deck.cards.length) || 1;
  $('#moreDlg').showModal();
}
$('#moreStart').onclick = () => {
  const deck = getDeck(moreDeckId), sel = document.querySelector('input[name=more]:checked');
  if (!deck || !sel) return;
  const n = Math.max(1, Math.min(9999, parseInt($('#moreCount').value, 10) || 1));
  $('#moreDlg').close();
  if (sel.value === 'new'){
    refreshDaily(deck);
    deck.today.extraNew = (deck.today.extraNew || 0) + Math.max(0, deck.today.newCount + n - deck.settings.newPerDay - (deck.today.extraNew || 0));
    save();
    const nw = deck.cards.filter(c => c.state === 'new').slice(0, n);
    return beginSession(deck, 'normal', nw.map(c => c.id), []);
  }
  if (sel.value === 'ahead'){
    const due = deck.cards.filter(c => c.state === 'review').sort((a,b) => a.due - b.due).slice(0, n);
    return beginSession(deck, 'ahead', due.map(c => c.id), []);
  }
  const pool = deck.cards.map(c => c.id);
  for (let i = pool.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  beginSession(deck, 'practice', pool.slice(0, n), []);
};
$('#doneMore').onclick = () => { if (lastDeckId && getDeck(lastDeckId)) openStudyMore(lastDeckId); };
function cardById(deck, id){ return deck.cards.find(c => c.id === id); }
function nextCard(){
  const deck = getDeck(ses.deckId), now = Date.now();
  ses.pending.sort((a,b) => cardById(deck,a).due - cardById(deck,b).due);
  let id = null;
  if (ses.pending.length && cardById(deck, ses.pending[0]).due <= now) id = ses.pending.shift();
  else if (ses.queue.length) id = ses.queue.shift();
  else if (ses.pending.length){
    // Nothing else left: show the next learning card early instead of making the user wait,
    // but avoid repeating the card that was just shown when another one is available.
    let idx = 0; if (ses.pending.length > 1 && ses.pending[0] === ses.lastId) idx = 1;
    id = ses.pending.splice(idx, 1)[0];
  }
  if (!id) return finishSession();
  ses.current = id; ses.lastId = id;
  const c = cardById(deck, id);
  $('#cardFront').textContent = c.front;
  $('#cardBack').textContent = c.back; $('#cardBack').hidden = true;
  $('#answerBar').hidden = false; $('#rateBar').hidden = true;
  renderStudyCounts(); $('#showBtn').focus({ preventScroll: true });
}
function renderStudyCounts(){
  const deck = getDeck(ses.deckId);
  const ids = [...ses.queue, ...ses.pending, ses.current].filter(Boolean);
  if (ses.mode === 'practice'){ $('#studyCounts').innerHTML = `<span>${ids.length} left</span>`; return; }
  let n = 0, l = 0, r = 0;
  for (const id of ids){ const s = cardById(deck, id).state; if (s === 'new') n++; else if (s === 'review') r++; else l++; }
  $('#studyCounts').innerHTML = countSpan(n,'c-new') + countSpan(l,'c-lrn') + countSpan(r,'c-rev');
}
function reveal(){
  if (!ses || !ses.current || !$('#rateBar').hidden) return;
  const deck = getDeck(ses.deckId), c = cardById(deck, ses.current), now = Date.now();
  const p = previewAll(c, now, deck.settings.retention);
  for (const btn of document.querySelectorAll('.rate')) btn.querySelector('span').textContent =
    ses.mode === 'practice' ? (btn.dataset.g === '1' ? 'see again' : 'next card') : fmtInterval(p[btn.dataset.g].due - now);
  $('#cardBack').hidden = false; $('#answerBar').hidden = true; $('#rateBar').hidden = false;
  document.querySelector('.rate[data-g="3"]').focus({ preventScroll: true });
}
function rate(g){
  if (!ses || !ses.current || $('#rateBar').hidden) return;
  if (ses.mode === 'practice'){
    if (g === 1) ses.queue.splice(Math.min(3, ses.queue.length), 0, ses.current);   // show it again shortly
    ses.stats[g]++; ses.reviewed++; ses.current = null; return nextCard();
  }
  const deck = getDeck(ses.deckId), idx = deck.cards.findIndex(c => c.id === ses.current), old = deck.cards[idx];
  const next = previewAll(old, Date.now(), deck.settings.retention)[g];
  if (old.state === 'new'){ refreshDaily(deck); deck.today.newCount++; }
  deck.cards[idx] = next;
  if (next.state === 'learning' || next.state === 'relearning') ses.pending.push(next.id);
  ses.stats[g]++; ses.reviewed++; ses.current = null;
  save(); nextCard();
}
function finishSession(){
  const s = ses ? ses.stats : {1:0,2:0,3:0,4:0};
  const total = ses ? ses.reviewed : 0;
  $('#doneTitle').textContent = total ? 'Session complete' : 'Nothing to study';
  const practice = ses && ses.mode === 'practice';
  $('#doneMsg').textContent = !total ? 'No cards are due in this deck right now.'
    : `You reviewed ${total} card${total === 1 ? '' : 's'}. ` + (practice ? 'Practice doesn\'t change your schedule.' : 'The schedule has been updated.');
  $('#doneStats').innerHTML = total ? [['Again',1,'c-lrn'],['Hard',2,''],['Good',3,'c-rev'],['Easy',4,'c-new']]
    .map(([lbl,g,cls]) => `<div><b class="${cls}">${s[g]}</b>${lbl}</div>`).join('') : '';
  ses = null; show('done');
}

