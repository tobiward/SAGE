/* ===================== AI study guide =====================
   Optional. Sends the user's material (and, if chosen, a summary of their study stats) to an AI provider
   with the user's own API key, then offers to import the CSV the AI writes. Nothing is sent until the
   user presses "Create study guide". The key is kept in this browser only and is never part of backups. */
const AI_STORE = 'sage-ai-v1';
// Gemini 3.5 Flash-Lite: stable, reads images and PDFs, up to 65k output tokens, and a much bigger free daily
// allowance than the full Flash models (about 500 requests a day versus about 20).
const AI_DEFAULT_MODELS = { gemini: 'gemini-3.5-flash-lite', anthropic: 'claude-sonnet-5-5', openai: '' };
// When Google is overloaded (it answers "503"), SAGE retries, then tries these models in turn. Unknown names are skipped.
const GEMINI_BACKUPS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
const AI_BUSY = s => [500, 502, 503, 504, 529].includes(s);   // temporary trouble on the provider's side
const AI_MAX_FILE_MB = 20, AI_MAX_FILES = 10;
const AI_DEFAULT_PROMPT = `You are SAGE's study guide: a friendly, accurate tutor built into a flashcard app.

The user will give you study material: pasted notes, text files, PDFs, or photos and screenshots. Do two things.

1. FLASHCARDS. Turn the most important facts into flashcards written as a CSV inside a \`\`\`csv code block.
   - Use exactly two columns with this header row: Front,Back
   - Keep each Front under 60 characters and each Back under 150 characters.
   - One fact per card. No duplicates. Use the material's own terms.
   - If a field contains a comma, wrap it in double quotes. Write any quote mark inside a field as two quote marks.

2. STUDY INSIGHTS. After the CSV, briefly explain:
   - the main themes and how they connect,
   - which ideas are most likely to be tested,
   - a short study plan using SAGE: Flash cards for daily review, the Quiz to check yourself,
     and games such as Lightning (fast true or false) or Survival (recall from memory) for practice.

If the user includes their study stats from SAGE, use them to point out weak spots, such as cards they forget often
or find difficult, and suggest what to focus on first.

Only use information from the material provided. If part of it is unclear or unreadable, say so instead of guessing.`;

let aiFiles = [], aiAbort = null, aiLastText = '', aiLastCSV = '';
function aiLoad(){ try { return JSON.parse(localStorage.getItem(AI_STORE)) || {}; } catch { return {}; } }
function aiSave(){
  const cfg = { provider: $('#aiProvider').value, model: $('#aiModel').value.trim(), base: $('#aiBase').value.trim(),
                prompt: $('#aiPrompt').value, remember: $('#aiRemember').checked };
  if (cfg.remember) cfg.key = $('#aiKey').value.trim();
  try { localStorage.setItem(AI_STORE, JSON.stringify(cfg)); } catch {}
}
function openAI(){
  const cfg = aiLoad();
  $('#aiProvider').value = cfg.provider || 'gemini';
  if (['gemini-2.5-flash', 'gemini-3.5-flash'].includes(cfg.model)) cfg.model = AI_DEFAULT_MODELS.gemini;   // old defaults saved by earlier versions
  $('#aiModel').value = cfg.model ?? AI_DEFAULT_MODELS[$('#aiProvider').value];
  $('#aiBase').value = cfg.base || '';
  $('#aiPrompt').value = cfg.prompt || AI_DEFAULT_PROMPT;
  $('#aiRemember').checked = cfg.remember ?? true;
  if (!$('#aiKey').value) $('#aiKey').value = cfg.key || '';
  $('#aiBaseWrap').hidden = $('#aiProvider').value !== 'openai';
  $('#aiDeck').innerHTML = '<option value="">None</option>' + db.decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  show('ai');
}
$('#aiBtn').onclick = openAI;
$('#aiProvider').onchange = () => {
  const p = $('#aiProvider').value;
  $('#aiBaseWrap').hidden = p !== 'openai';
  $('#aiModel').value = AI_DEFAULT_MODELS[p];
  $('#aiModel').placeholder = p === 'openai' ? 'Model name from your provider' : '';
  aiSave();
};
['#aiModel', '#aiBase', '#aiPrompt', '#aiKey'].forEach(id => $(id).addEventListener('input', aiSave));
$('#aiRemember').onchange = aiSave;
$('#aiShowKey').onclick = () => {
  const k = $('#aiKey'), showing = k.type === 'text';
  k.type = showing ? 'password' : 'text'; $('#aiShowKey').textContent = showing ? 'Show' : 'Hide';
};
$('#aiForget').onclick = () => { $('#aiKey').value = ''; aiSave(); toast('Key removed from this browser'); };
$('#aiResetPrompt').onclick = () => { $('#aiPrompt').value = AI_DEFAULT_PROMPT; aiSave(); toast('Instructions reset'); };

// ----- files -----
function aiFileKind(f){
  if (/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return 'image';
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf';
  if (f.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(f.name)) return 'text';
  return null;
}
$('#aiFiles').onchange = e => {
  for (const f of e.target.files){
    if (aiFiles.length >= AI_MAX_FILES){ toast(`Up to ${AI_MAX_FILES} files at a time.`); break; }
    const kind = aiFileKind(f);
    if (!kind){ toast(`${f.name}: use images, PDFs, or text files.`); continue; }
    if (f.size > AI_MAX_FILE_MB * 1048576){ toast(`${f.name} is over ${AI_MAX_FILE_MB} MB.`); continue; }
    const entry = { name: f.name, kind, type: kind === 'pdf' ? 'application/pdf' : f.type, data: null };
    aiFiles.push(entry);
    const r = new FileReader();
    r.onload = () => { entry.data = kind === 'text' ? String(r.result) : String(r.result).split(',')[1]; aiRenderFiles(); };
    r.onerror = () => { aiFiles = aiFiles.filter(x => x !== entry); toast(`Could not read ${f.name}.`); aiRenderFiles(); };
    kind === 'text' ? r.readAsText(f) : r.readAsDataURL(f);
  }
  e.target.value = ''; aiRenderFiles();
};
function aiRenderFiles(){
  $('#aiFileList').innerHTML = aiFiles.map((f, i) =>
    `<span class="ai-chip">${esc(f.name)}${f.data == null ? ' (reading...)' : ''}<button type="button" data-rm="${i}" aria-label="Remove ${esc(f.name)}">&times;</button></span>`).join('');
}
$('#aiFileList').onclick = e => { const b = e.target.closest('[data-rm]'); if (b){ aiFiles.splice(+b.dataset.rm, 1); aiRenderFiles(); } };

// ----- study stats the AI can use -----
function aiDeckStats(deck){
  const cut = t => { t = qClean(t); return t.length > 120 ? t.slice(0, 117) + '...' : t; };
  const c = deckCounts(deck), studied = deck.cards.filter(x => x.state !== 'new');
  const hardest = studied.slice().sort((a, b) => ((b.lapses || 0) * 3 + b.d) - ((a.lapses || 0) * 3 + a.d)).slice(0, 15);
  const avgD = studied.length ? (studied.reduce((n, x) => n + x.d, 0) / studied.length).toFixed(1) : 'n/a';
  return [`My study stats from SAGE for the deck "${deck.name}":`,
    `- ${deck.cards.length} cards: ${deck.cards.length - studied.length} not studied yet, ${studied.length} studied.`,
    `- Due today: ${c.rev} reviews, ${c.lrn} in learning, ${c.nw} new cards available.`,
    `- Average difficulty of studied cards: ${avgD} out of 10.`,
    deck.quiz?.last ? `- Last quiz: ${deck.quiz.last.pct}% on ${deck.quiz.last.n} questions.` : '- No quizzes taken yet.',
    hardest.length ? 'Cards I find hardest (front | back, times forgotten, difficulty out of 10):' : '',
    ...hardest.map(x => `- ${cut(x.front)} | ${cut(x.back)} (forgotten ${x.lapses || 0}x, difficulty ${x.d.toFixed(1)})`)
  ].filter(Boolean).join('\n');
}

// ----- calling the provider -----
async function aiCallAnthropic(cfg, prompt, text, files, signal){
  const content = [];
  for (const f of files){
    if (f.kind === 'image') content.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: f.data } });
    if (f.kind === 'pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
    if (f.kind === 'text') content.push({ type: 'text', text: `File: ${f.name}\n\n${f.data}` });
  }
  content.push({ type: 'text', text });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01',
               'anthropic-dangerous-direct-browser-access': 'true' },      // required for calls made straight from a browser
    body: JSON.stringify({ model: cfg.model, max_tokens: 8192, system: prompt, messages: [{ role: 'user', content }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.message || `Request failed (${res.status})`), { status: res.status });
  return { text: (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n'), cut: data.stop_reason === 'max_tokens' };
}
async function aiCallGemini(cfg, prompt, text, files, signal){
  const parts = [];
  for (const f of files){
    if (f.kind === 'image' || f.kind === 'pdf') parts.push({ inline_data: { mime_type: f.type, data: f.data } });
    if (f.kind === 'text') parts.push({ text: `File: ${f.name}\n\n${f.data}` });
  }
  parts.push({ text });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
    body: JSON.stringify({ system_instruction: { parts: [{ text: prompt }] }, contents: [{ role: 'user', parts }],
                           generationConfig: { maxOutputTokens: 8192 } })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok){
    const msg = data.error?.message || `Request failed (${res.status})`;
    throw Object.assign(new Error(msg), { status: /api key/i.test(msg) ? 401 : res.status });   // Google reports bad keys as 400
  }
  const cand = data.candidates?.[0];
  return { text: (cand?.content?.parts || []).map(p => p.text || '').join(''), cut: cand?.finishReason === 'MAX_TOKENS' };
}
async function aiCallOpenAI(cfg, prompt, text, files, signal){
  const parts = [];
  for (const f of files){
    if (f.kind === 'image') parts.push({ type: 'image_url', image_url: { url: `data:${f.type};base64,${f.data}` } });
    if (f.kind === 'pdf') parts.push({ type: 'file', file: { filename: f.name, file_data: `data:application/pdf;base64,${f.data}` } });
    if (f.kind === 'text') parts.push({ type: 'text', text: `File: ${f.name}\n\n${f.data}` });
  }
  parts.push({ type: 'text', text });
  const base = (cfg.base || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: prompt }, { role: 'user', content: parts }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.message || `Request failed (${res.status})`), { status: res.status });
  const choice = data.choices?.[0];
  return { text: choice?.message?.content || '', cut: choice?.finish_reason === 'length' };
}
function aiStatus(msg, bad){ $('#aiStatus').textContent = msg; $('#aiStatus').classList.toggle('bad', !!bad); }
$('#aiRun').onclick = async () => {
  const cfg = { provider: $('#aiProvider').value, model: $('#aiModel').value.trim(), base: $('#aiBase').value.trim(), key: $('#aiKey').value.trim() };
  const material = $('#aiText').value.trim(), deck = getDeck($('#aiDeck').value);
  if (!cfg.key) return aiStatus('Paste your API key in the Connection panel first.', true);
  if (!cfg.model) return aiStatus('Enter a model name in the Connection panel.', true);
  if (!material && !aiFiles.length && !deck) return aiStatus('Paste some material, add a file, or choose a deck to get insights on.', true);
  if (aiFiles.some(f => f.data == null)) return aiStatus('Still reading your files. Try again in a moment.', true);
  const text = [material ? `My study material:\n\n${material}` : (aiFiles.length ? 'My study material is in the attached files.' : 'I have no new material this time; please give me study insights only.'),
                deck ? aiDeckStats(deck) : ''].filter(Boolean).join('\n\n');
  aiAbort = new AbortController();
  $('#aiRun').disabled = true; $('#aiCancel').hidden = false; $('#aiOut').hidden = true; $('#aiOutActions').hidden = true;
  const started = Date.now();
  aiPhase = 'Working on it...'; aiStatus(aiPhase);
  const tick = setInterval(() => aiStatus(`${aiPhase} ${Math.round((Date.now() - started) / 1000)}s`), 500);
  try {
    const out = await aiCallWithRetry(cfg, $('#aiPrompt').value.trim() || AI_DEFAULT_PROMPT, text, aiFiles, aiAbort.signal);
    aiShowResult(out.text);
    const switched = out.model !== cfg.model ? ` (answered by ${out.model} because ${cfg.model} was busy or unavailable)` : '';
    aiStatus(out.cut ? 'The response hit the length limit and may be cut off. Try sending less material at once.' : `Done${switched}.`, out.cut);
  } catch (err){
    if (err.name === 'AbortError') aiStatus('Cancelled.');
    else if (err.status === 401 || err.status === 403) aiStatus('The API key was rejected. Check that it is correct and active.', true);
    else if (err.status === 404) aiStatus("The model name wasn't found. It may have been renamed or retired; check your provider's model list and update the Model box.", true);
    else if (err.status === 429) aiStatus('The provider says you are sending too many requests or are out of credit. Wait a bit or check your account.', true);
    else if (AI_BUSY(err.status)) aiStatus('The AI service is overloaded right now, even after several tries. Please try again in a few minutes.', true);
    else if (err.status) aiStatus(`The provider returned an error: ${err.message}`, true);
    else aiStatus("Couldn't reach the AI provider. Check your internet connection and the API address.", true);
  } finally {
    clearInterval(tick); aiAbort = null; $('#aiRun').disabled = false; $('#aiCancel').hidden = true;
  }
};
$('#aiCancel').onclick = () => aiAbort && aiAbort.abort();
let aiPhase = '';
const aiWait = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Cancelled', 'AbortError')); }, { once: true });
});
// Busy providers are common, so: retry the same model twice with a short wait, then (for Gemini) move on to backup models.
// Key problems and bad requests stop right away, since retrying can't fix them.
async function aiCallWithRetry(cfg, prompt, text, files, signal){
  const call = { gemini: aiCallGemini, anthropic: aiCallAnthropic, openai: aiCallOpenAI }[cfg.provider];
  const models = cfg.provider === 'gemini' ? [...new Set([cfg.model, ...GEMINI_BACKUPS])] : [cfg.model];
  let lastErr;
  for (let m = 0; m < models.length; m++){
    for (let attempt = 1; attempt <= 3; attempt++){
      try { const out = await call({ ...cfg, model: models[m] }, prompt, text, files, signal); return { ...out, model: models[m] }; }
      catch (err){
        if (err.name === 'AbortError') throw err;
        if (m === 0 || err.status !== 404) lastErr = err;      // a missing backup model isn't the error worth reporting
        if (AI_BUSY(err.status) && attempt < 3){
          aiPhase = `The AI service is busy. Trying again (${attempt + 1} of 3)...`;
          await aiWait(attempt * 2000, signal); continue;
        }
        if (!(AI_BUSY(err.status) || err.status === 429 || err.status === 404)) throw err;
        break;                                                   // try the next model, if any
      }
    }
    if (m < models.length - 1) aiPhase = `${models[m]} is unavailable. Trying ${models[m + 1]}...`;
  }
  throw lastErr;
}
// Pulls the CSV out of an AI reply: the ```csv block if there is one, otherwise any code block.
function extractCSV(text){
  const m = text.match(/```csv[^\n]*\n([\s\S]*?)```/i) || text.match(/```[^\n]*\n([\s\S]*?)```/);
  return m ? m[1].trim() : '';
}
function aiShowResult(text){
  aiLastText = text;
  const found = parsePasted(text);
  aiLastCSV = found.length ? toCSV(found) : '';
  // show the reply as plain text, with code blocks set apart; nothing from the AI is ever run as HTML
  const parts = text.split(/```[^\n]*\n([\s\S]*?)```/);
  $('#aiOut').innerHTML = parts.map((p, i) => i % 2 ? `<pre>${esc(p.trim())}</pre>` : esc(p.trim())).filter(Boolean).join('\n');
  $('#aiOut').hidden = false; $('#aiOutActions').hidden = false;
  const hasHeader = found.length && /^(front|term|question|word)$/i.test(found[0][0]);
  const rows = found.length - (hasHeader ? 1 : 0);
  $('#aiImport').hidden = $('#aiDownload').hidden = !aiLastCSV;
  $('#aiImport').textContent = `Import ${plural(Math.max(0, rows), 'card')}`;
}
$('#aiCopy').onclick = async () => {
  try { await navigator.clipboard.writeText(aiLastText); toast('Copied'); } catch { toast('Copy failed. Select the text and copy it instead.'); }
};
$('#aiDownload').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([aiLastCSV + '\n'], { type: 'text/csv' }));
  a.download = 'sage-study-guide.csv'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#aiImport').onclick = () => { if (aiLastCSV){ show('import'); $('#fileIn').value = ''; importText(aiLastCSV, 'AI study guide.csv', parsePasted(aiLastText)); } };

