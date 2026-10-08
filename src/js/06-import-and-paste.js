/* ===================== CSV import ===================== */
function parseCSV(text, forcedDelim){
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delims = [',', '\t', ';'];
  const delim = forcedDelim || delims.reduce((best, d) => first.split(d).length > first.split(best).length ? d : best, ',');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (q){
      if (ch === '"'){ if (text[i+1] === '"'){ field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"' && field.trim() === ''){ field = ''; q = true; }    // a quoted field, even after a space ("a", "b")
    else if (ch === delim){ row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r'){
      if (ch === '\r' && text[i+1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== '')).map(r => r.map(c => c.trim()));
}

let imp = null; // { rows, fileName }
function startImport(){
  imp = null; $('#fileIn').value = ''; $('#importOpts').hidden = true; show('import');
}
function loadFile(file){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => importText(String(reader.result), file.name);
  reader.onerror = () => toast('Could not read that file.');
  reader.readAsText(file);
}
// Opens the import screen for CSV text, from a file or from the AI study guide.
// ----- Pasted text: CSV, tab-separated, markdown tables, or "term: definition" lists, even inside a longer AI reply -----
const pasteCell = c => c.replace(/\*\*|__|`/g, '').trim();
function pasteRows(chunk){
  const lines = chunk.split('\n');
  // 1. markdown table (| Front | Back |)
  const sep = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  const table = lines.filter(l => l.includes('|') && !sep.test(l))
    .map(l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(pasteCell))
    .filter(r => r.length >= 2 && r.some(Boolean));
  if (table.length >= 2 && lines.some(l => sep.test(l))) return table;
  // 2. delimited lines: use the paragraph with the most lines that split into 2+ fields
  let best = [];
  for (const block of chunk.split(/\n\s*\n/)){
    for (const d of ['\t', ',', ';']){
      const rows = parseCSV(block, d).map(r => r.map(pasteCell)).filter(r => r.filter(Boolean).length >= 2);
      if (rows.length > best.length) best = rows;
    }
  }
  if (best.length >= 2) return best;
  // 3. lists like "Term: definition", "Term - definition", "1. **Term** — definition"
  const list = lines.map(l => l.match(/^\s*(?:[-*\u2022]\s+|\d+[.)]\s+)?(.+?)\s*(?:\s[-\u2013\u2014]\s|:\s+|\s=\s)\s*(.+)$/))
    .filter(Boolean).map(m => [pasteCell(m[1]), pasteCell(m[2])]).filter(r => r[0] && r[1]);
  if (list.length >= 2) return list;
  return best;
}
function parsePasted(text){
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fences = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(m => m[1]);
  for (const chunk of fences){ const rows = pasteRows(chunk); if (rows.length) return rows; }
  return pasteRows(text);
}
const toCSV = rows => rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n');
function importText(text, fileName, parsedRows){
  {
    const rows = parsedRows || parseCSV(text);
    if (!rows.length){ toast(parsedRows ? "Couldn't find any cards in that text. See Help for formats that work." : 'That file has no rows to import.'); return; }
    const width = Math.max(...rows.map(r => r.length));
    if (width < 2){ toast('Each row needs at least two columns: front and back.'); return; }
    imp = { rows, width, fileName };
    const headerWords = /^(front|back|question|answer|term|definition|word|meaning|prompt|response)$/i;
    $('#hasHeader').checked = rows[0].filter(c => headerWords.test(c)).length >= 1;
    $('#newDeckName').value = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'New deck';
    const ex = $('#existingDeck');
    ex.innerHTML = db.decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    $('#existingRadioWrap').hidden = !db.decks.length;
    document.querySelector('input[name=target][value=new]').checked = true;
    syncTarget(); buildColumnSelects(); $('#importOpts').hidden = false;
  }
}
function buildColumnSelects(){
  const head = $('#hasHeader').checked ? imp.rows[0] : null;
  const opts = Array.from({ length: imp.width }, (_, i) =>
    `<option value="${i}">Column ${i+1}${head && head[i] ? ': ' + esc(head[i]) : ''}</option>`).join('');
  const f = $('#colFront').value, b = $('#colBack').value;
  $('#colFront').innerHTML = opts; $('#colBack').innerHTML = opts;
  $('#colFront').value = f && +f < imp.width ? f : '0';
  $('#colBack').value = b && +b < imp.width ? b : '1';
  renderPreview();
}
function importRows(){
  const fi = +$('#colFront').value, bi = +$('#colBack').value;
  const data = $('#hasHeader').checked ? imp.rows.slice(1) : imp.rows;
  // keep every column on the card too, so the card layout can be changed later in the deck editor
  return data.map(r => ({ front: r[fi] || '', back: r[bi] || '', cols: Array.from({ length: imp.width }, (_, k) => r[k] || '') }))
             .filter(r => r.front || r.back);
}
function renderPreview(){
  const rows = importRows();
  $('#previewTbl').innerHTML = '<tr><th>Front</th><th>Back</th></tr>' +
    rows.slice(0, 5).map(r => `<tr><td>${esc(r.front)}</td><td>${esc(r.back)}</td></tr>`).join('');
  $('#fileInfo').innerHTML = `<strong>${esc(imp.fileName)}</strong>: ${rows.length} card${rows.length === 1 ? '' : 's'} found`;
  $('#doImport').textContent = `Import ${rows.length} card${rows.length === 1 ? '' : 's'}`;
  $('#doImport').disabled = !rows.length;
}
function syncTarget(){
  const isNew = document.querySelector('input[name=target]:checked').value === 'new';
  $('#newNameWrap').hidden = !isNew; $('#existingWrap').hidden = isNew;
}
function doImport(){
  const rows = importRows();
  const isNew = document.querySelector('input[name=target]:checked').value === 'new';
  let deck;
  if (isNew){
    const name = $('#newDeckName').value.trim();
    if (!name){ toast('Give the deck a name.'); $('#newDeckName').focus(); return; }
    deck = makeDeck(name); db.decks.push(deck);
  } else deck = getDeck($('#existingDeck').value);
  if (!deck.columns && !deck.cards.length && imp.width > 2){
    const head = $('#hasHeader').checked ? imp.rows[0] : null;
    deck.columns = Array.from({ length: imp.width }, (_, k) => (head && head[k]) || `Column ${k + 1}`);
    deck.layout = { front: [+$('#colFront').value], back: [+$('#colBack').value] };
  }
  const seen = new Set(deck.cards.map(c => c.front.toLowerCase()));
  let added = 0, skipped = 0;
  for (const r of rows){
    const key = r.front.toLowerCase();
    if ($('#skipDup').checked && seen.has(key)){ skipped++; continue; }
    const card = newCard(r.front, r.back);
    if (deck.columns) card.cols = r.cols;
    seen.add(key); deck.cards.push(card); added++;
  }
  save(); renderHome();
  toast(`Imported ${added} card${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}`);
}

