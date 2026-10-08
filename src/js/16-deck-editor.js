/* ===================== Deck editor =====================
   Add, edit, delete, and reorder cards. If the deck came from a CSV with extra columns,
   choose which columns make up each side of the card. */
const ED_PAGE = 50;
let ed = null, edSaveTimer = null;
const edDeck = () => getDeck(ed.deckId);
const edSaveSoon = () => { clearTimeout(edSaveTimer); edSaveTimer = setTimeout(save, 400); };
function openEditor(deckId){
  const deck = getDeck(deckId); if (!deck) return renderHome();
  ed = { deckId, query: '', shown: ED_PAGE, undo: null };
  $('#edTitle').textContent = `Edit: ${deck.name}`;
  $('#edSearch').value = ''; $('#edUndo').hidden = true;
  edRenderLayout(); edRender();
  show('edit');
}
function edClose(){
  const deck = edDeck(); clearTimeout(edSaveTimer);
  if (deck) deck.cards = deck.cards.filter(c => c.front.trim() || c.back.trim());
  save(); ed = null;
}
$('#editCardsBtn').onclick = () => { $('#settingsDlg').close(); openEditor(optDeckId); };

// ----- card layout from CSV columns -----
function edRenderLayout(){
  const deck = edDeck(), cols = deck.columns;
  $('#edLayout').hidden = !cols;
  if (!cols) return;
  const sample = deck.cards.find(c => c.cols);
  $('#edCols').innerHTML = '<tr><th>Column</th><th>Example</th><th>Front</th><th>Back</th></tr>' + cols.map((name, k) => `<tr>
      <td><strong>${esc(name)}</strong></td><td class="sample">${esc(sample ? sample.cols[k] || '' : '')}</td>
      <td><input type="checkbox" data-side="front" data-col="${k}" ${deck.layout.front.includes(k) ? 'checked' : ''} aria-label="${esc(name)} on front"></td>
      <td><input type="checkbox" data-side="back" data-col="${k}" ${deck.layout.back.includes(k) ? 'checked' : ''} aria-label="${esc(name)} on back"></td></tr>`).join('');
}
$('#edApply').onclick = () => {
  const deck = edDeck(), pick = side => [...document.querySelectorAll(`#edCols input[data-side="${side}"]:checked`)].map(b => +b.dataset.col);
  const layout = { front: pick('front'), back: pick('back') };
  if (!layout.front.length || !layout.back.length) return toast('Pick at least one column for each side.');
  deck.layout = layout;
  let changed = 0, kept = 0;
  for (const c of deck.cards){
    if (!c.cols) continue;
    if (c.edited){ kept++; continue; }
    c.front = layout.front.map(k => c.cols[k] || '').filter(Boolean).join('\n');   // several columns stack on separate lines
    c.back = layout.back.map(k => c.cols[k] || '').filter(Boolean).join('\n');
    changed++;
  }
  save(); edRender();
  toast(`Updated ${plural(changed, 'card')}` + (kept ? `, kept ${kept} edited by hand` : ''));
};

// ----- card list -----
function edMatches(){
  const q = ed.query.trim().toLowerCase(), cards = edDeck().cards;
  return q ? cards.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)) : cards;
}
const edStateLabel = c => c.state === 'new' ? 'New' : c.state === 'review' ? 'Review' : 'Learning';
function edRender(){
  const deck = edDeck(), list = edMatches(), searching = !!ed.query.trim();
  const visible = list.slice(0, ed.shown);
  $('#edCount').textContent = searching ? `${list.length} of ${plural(deck.cards.length, 'card')}` : plural(deck.cards.length, 'card');
  $('#edOrderHint').textContent = searching ? 'Clear the search to reorder cards.'
    : 'Drag a card by its handle, or use the arrows, to change the order. New cards are studied in this order. Changes save automatically.';
  $('#edList').innerHTML = visible.map(c => {
    const pos = deck.cards.indexOf(c);
    return `<li class="ed-row" data-id="${c.id}">
      ${searching ? '<span></span>' : `<button class="ed-handle" draggable="true" aria-label="Drag to reorder" title="Drag to reorder"></button>`}
      <span class="ed-num">${pos + 1}<small>${edStateLabel(c)}</small></span>
      <div class="ed-fields">
        <label>Front <textarea data-f="front" rows="1" aria-label="Front of card ${pos + 1}">${esc(c.front)}</textarea></label>
        <label><span>Back${c.cols && c.edited ? '<span class="ed-tag">edited by hand</span>' : ''}</span>
          <textarea data-f="back" rows="1" aria-label="Back of card ${pos + 1}">${esc(c.back)}</textarea></label>
      </div>
      <div class="ed-tools">
        ${searching ? '' : `<button class="btn quiet" data-move="-1" aria-label="Move up" ${pos === 0 ? 'disabled' : ''}>&uarr;</button>
        <button class="btn quiet" data-move="1" aria-label="Move down" ${pos === deck.cards.length - 1 ? 'disabled' : ''}>&darr;</button>`}
        <button class="btn quiet" data-del aria-label="Delete card">Delete</button>
      </div></li>`;
  }).join('');
  $('#edMore').hidden = list.length <= ed.shown;
  $('#edMore').textContent = `Show more (${list.length - ed.shown} left)`;
  document.querySelectorAll('#edList textarea').forEach(edGrow);
}
function edGrow(t){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }
const edCard = el => edDeck().cards.find(c => c.id === el.closest('.ed-row').dataset.id);
$('#edList').addEventListener('input', e => {
  const t = e.target.closest('textarea'); if (!t) return;
  const c = edCard(t); c[t.dataset.f] = t.value;
  if (c.cols) c.edited = true;                       // keep hand edits when the column layout changes
  edGrow(t); edSaveSoon();
});
$('#edList').addEventListener('click', e => {
  const deck = edDeck(), row = e.target.closest('.ed-row'); if (!row) return;
  const c = edCard(row), i = deck.cards.indexOf(c);
  const mv = e.target.closest('[data-move]');
  if (mv){
    const j = i + +mv.dataset.move; if (j < 0 || j >= deck.cards.length) return;
    [deck.cards[i], deck.cards[j]] = [deck.cards[j], deck.cards[i]];
    save(); edRender();
    $(`#edList .ed-row[data-id="${c.id}"] [data-move="${mv.dataset.move}"]`)?.focus();
  }
  if (e.target.closest('[data-del]')){
    deck.cards.splice(i, 1); ed.undo = { card: c, index: i };
    $('#edUndoMsg').textContent = `Deleted "${(c.front || c.back || 'empty card').slice(0, 40)}".`; $('#edUndo').hidden = false;
    save(); edRender();
  }
});
$('#edUndoBtn').onclick = () => {
  if (!ed.undo) return;
  edDeck().cards.splice(ed.undo.index, 0, ed.undo.card); ed.undo = null;
  $('#edUndo').hidden = true; save(); edRender();
};
$('#edAdd').onclick = () => {
  const deck = edDeck(), c = newCard('', '');
  deck.cards.push(c); ed.query = ''; $('#edSearch').value = '';
  ed.shown = Math.max(ed.shown, deck.cards.length);
  save(); edRender();
  const t = $(`#edList .ed-row[data-id="${c.id}"] textarea`);
  t.scrollIntoView({ block: 'center' }); t.focus();
};
$('#edSearch').addEventListener('input', e => { ed.query = e.target.value; ed.shown = ED_PAGE; edRender(); });
$('#edMore').onclick = () => { ed.shown += ED_PAGE; edRender(); };
// drag and drop (by the handle) to reorder
let edDragId = null;
$('#edList').addEventListener('dragstart', e => {
  const h = e.target.closest('.ed-handle'); if (!h){ e.preventDefault(); return; }
  const row = h.closest('.ed-row'); edDragId = row.dataset.id;
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', edDragId);
  e.dataTransfer.setDragImage(row, 20, 20); row.classList.add('dragging');
});
$('#edList').addEventListener('dragover', e => {
  const row = e.target.closest('.ed-row'); if (!edDragId || !row) return;
  e.preventDefault();
  const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
  document.querySelectorAll('.ed-row.drop-before,.ed-row.drop-after').forEach(r => r.classList.remove('drop-before', 'drop-after'));
  if (row.dataset.id !== edDragId) row.classList.add(after ? 'drop-after' : 'drop-before');
});
$('#edList').addEventListener('drop', e => {
  const row = e.target.closest('.ed-row'); if (!edDragId || !row) return;
  e.preventDefault();
  const deck = edDeck(), after = row.classList.contains('drop-after');
  if (row.dataset.id !== edDragId){
    const from = deck.cards.findIndex(c => c.id === edDragId), [moved] = deck.cards.splice(from, 1);
    let to = deck.cards.findIndex(c => c.id === row.dataset.id) + (after ? 1 : 0);
    deck.cards.splice(to, 0, moved); save();
  }
  edDragId = null; edRender();
});
$('#edList').addEventListener('dragend', () => {
  edDragId = null;
  document.querySelectorAll('.ed-row').forEach(r => r.classList.remove('dragging', 'drop-before', 'drop-after'));
});

