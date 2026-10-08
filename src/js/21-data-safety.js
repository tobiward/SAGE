/* ===================== Data safety =====================
   SAGE has no accounts, so the browser is the database. This module makes losing data unlikely and recoverable:
     1. Storage protection: asks the browser not to clear SAGE's data on its own when space runs low.
     2. Autosave to a file (Chrome and Edge): the user picks a file once and SAGE keeps it up to date.
     3. Backup reminder: if nothing has been saved outside the browser for a week, a small note offers a one-click backup.
   Preferences for this (and the donate link) live under their own storage key, never inside backups. */
const PREFS_KEY = 'sage-prefs-v1';
const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } })();
function savePrefs(){ try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} }
const DAY_MS = 864e5, NUDGE_AFTER_DAYS = 7, NUDGE_SNOOZE_DAYS = 3;
const fsSupported = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
let autoHandle = null, autoState = 'off', autoTimer = null, autoName = '';
const ago = t => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return plural(Math.round(h / 24), 'day') + ' ago';
};

// Called after every save.
function afterSave(){
  if (!db.decks.length) return;
  const now = Date.now();
  if (!prefs.firstUse) prefs.firstUse = now;
  prefs.lastChange = now; savePrefs();
  askPersist(); autoSoon();
}

// ----- 1. storage protection -----
async function askPersist(){
  if (prefs.persistAsked || !navigator.storage?.persist) return;
  prefs.persistAsked = true; savePrefs();
  try { prefs.persisted = await navigator.storage.persist(); } catch { prefs.persisted = false; }
  savePrefs();
}

// ----- backup file -----
const backupData = () => ({ app: APP_NAME, version: APP_VERSION, exported: new Date().toISOString(), ...db });
function exportBackup(){
  const blob = new Blob([JSON.stringify(backupData(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${APP_NAME.toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  prefs.lastBackup = Date.now(); savePrefs(); renderBackupNudge(); renderBackupStatus();
}

// ----- 2. autosave to a file -----
// The chosen file's handle is kept in IndexedDB so SAGE can find it again next time.
function handleStore(op, value){
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('sage-files', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('handles');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      try {
        const store = open.result.transaction('handles', op === 'get' ? 'readonly' : 'readwrite').objectStore('handles');
        const req = op === 'get' ? store.get('autosave') : op === 'delete' ? store.delete('autosave') : store.put(value, 'autosave');
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      } catch (e){ reject(e); }                   // e.g. a handle the browser can't store
    };
  });
}
const FILE_TYPES = [{ description: 'SAGE save file', accept: { 'application/json': ['.json'] } }];
async function autoInit(){
  if (!fsSupported) return renderAuto();
  try { autoHandle = await handleStore('get'); } catch { autoHandle = null; }
  if (autoHandle){
    autoName = autoHandle.name;
    try { autoState = (await autoHandle.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'on' : 'paused'; }
    catch { autoState = 'paused'; }
  }
  renderAuto(); renderBackupNudge();
}
async function autoUse(handle){
  autoHandle = handle; autoName = handle.name; autoState = 'on';
  try { await handleStore('put', handle); } catch { /* still works until SAGE is closed */ }
  await autoWrite();
}
async function autoWrite(){
  clearTimeout(autoTimer); autoTimer = null;
  if (autoState !== 'on' || !autoHandle) return;
  try {
    const out = await autoHandle.createWritable();
    await out.write(JSON.stringify(backupData(), null, 1)); await out.close();
    prefs.lastBackup = prefs.autoLast = Date.now(); savePrefs();
  } catch (e){
    autoState = e && e.name === 'NotAllowedError' ? 'paused' : 'error';
  }
  renderAuto(); renderBackupNudge();
}
function autoSoon(){ if (autoState === 'on'){ clearTimeout(autoTimer); autoTimer = setTimeout(autoWrite, 1500); } }
document.addEventListener('visibilitychange', () => { if (document.hidden && autoTimer) autoWrite(); });   // save before the tab goes away

$('#autoChoose').onclick = async () => {
  try { await autoUse(await window.showSaveFilePicker({ suggestedName: 'SAGE decks.json', types: FILE_TYPES })); toast('Autosave is on'); }
  catch (e){ if (e.name !== 'AbortError') toast("Couldn't use that file. Try another location."); }
};
$('#autoOpen').onclick = async () => {        // e.g. on a new computer: load the decks from an existing save file, then keep saving to it
  let handle;
  try { [handle] = await window.showOpenFilePicker({ types: FILE_TYPES }); } catch { return; }
  try {
    const data = JSON.parse(await (await handle.getFile()).text());
    if (!data || !Array.isArray(data.decks)) throw 0;
    const clean = cleanDb(data);
    if (db.decks.length && !await askConfirm('Use this save file?', `Your current decks will be replaced with the ${clean.decks.length} deck(s) in this file, and SAGE will keep it up to date.`, 'Use this file')) return;
    if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return toast('SAGE needs permission to save to that file.');
    db = clean; save(); renderHome(); await autoUse(handle); toast('Decks loaded. Autosave is on');
  } catch { toast("That file isn't a SAGE save file."); }
};
$('#autoReconnect').onclick = async () => {
  try { if ((await autoHandle.requestPermission({ mode: 'readwrite' })) === 'granted'){ autoState = 'on'; await autoWrite(); } } catch {}
  renderAuto(); renderBackupNudge();
};
$('#autoStop').onclick = async () => {
  try { await handleStore('delete'); } catch {}
  autoHandle = null; autoState = 'off'; autoName = '';
  renderAuto(); renderBackupNudge(); toast('Autosave is off. The file itself was not deleted.');
};
function renderAuto(){
  renderBackupStatus();
  $('#autoBox').hidden = !fsSupported;
  const status = {
    off: 'Pick a file once, such as in your Documents folder, and SAGE keeps it up to date every time you study. Your decks are then safe even if browser data is cleared, and the file works as a backup on any computer.',
    on: `Saving to "${autoName}"${prefs.autoLast ? `, last saved ${ago(prefs.autoLast)}` : ''}.`,
    paused: `Autosave to "${autoName}" is paused until you allow it again. Browsers ask for this after a restart.`,
    error: `Couldn't save to "${autoName}". It may have been moved or deleted. Choose a save file again.`
  }[autoState];
  $('#autoStatus').textContent = status;
  $('#autoChoose').hidden = autoState === 'on' || autoState === 'paused';
  $('#autoOpen').hidden = autoState === 'on' || autoState === 'paused';
  $('#autoReconnect').hidden = autoState !== 'paused';
  $('#autoStop').hidden = autoState === 'off';
  $('#autoChoose').textContent = autoState === 'error' ? 'Choose a save file again' : 'Choose a save file';
}
function renderBackupStatus(){
  $('#backupStatus').textContent = (prefs.lastBackup ? `Last saved outside the browser ${ago(prefs.lastBackup)}. ` : 'No backup saved yet. ') +
    'A backup file also moves your decks to another computer or browser.' + (fsSupported ? '' : ' (Chrome and Edge can also autosave to a file.)');
  $('#persistStatus').textContent = prefs.persisted ? 'Storage protection is on: this browser won\u2019t clear SAGE\u2019s data on its own when space runs low.'
    : prefs.persistAsked ? 'Storage protection wasn\u2019t granted by this browser, so backups matter even more.' : '';
}
$('#backupBtn').addEventListener('click', () => { renderAuto(); renderBackupStatus(); });

// ----- 3. backup reminder -----
function nudgeReason(){
  if (!db.decks.length) return null;
  if (autoState === 'paused') return 'paused';
  if (autoState === 'on') return null;
  const now = Date.now(), since = prefs.lastBackup || prefs.firstUse;
  if (!since || now < (prefs.snoozeUntil || 0)) return null;
  if (prefs.lastBackup && (prefs.lastChange || 0) <= prefs.lastBackup) return null;   // nothing new since the last backup
  return now - since > NUDGE_AFTER_DAYS * DAY_MS ? 'old' : null;
}
function renderBackupNudge(){
  const why = nudgeReason(), box = $('#backupNudge');
  box.hidden = !why; if (!why) return;
  if (why === 'paused'){
    $('#nudgeMsg').textContent = `Autosave to "${autoName}" is paused. Allow it again to keep your decks safe.`;
    $('#nudgeAction').textContent = 'Reconnect';
  } else {
    $('#nudgeMsg').textContent = (prefs.lastBackup ? `Your last backup was ${ago(prefs.lastBackup)}.` : "You haven't saved a backup yet.") +
      ' A backup keeps your decks safe if browser data gets cleared.';
    $('#nudgeAction').textContent = 'Save a backup';
  }
}
$('#nudgeAction').onclick = () => { if (nudgeReason() === 'paused') $('#autoReconnect').click(); else exportBackup(); };
$('#nudgeLater').onclick = () => { prefs.snoozeUntil = Date.now() + NUDGE_SNOOZE_DAYS * DAY_MS; savePrefs(); renderBackupNudge(); };
autoInit();
