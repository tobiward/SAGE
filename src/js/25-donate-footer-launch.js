// ----- donate link and footer -----
function syncDonate(){
  const has = CRYPTO_WALLETS.some(w => w.address.trim()), visible = has && !prefs.hideDonate;
  $('#donateLink').hidden = !visible; $('#footSupport').hidden = !visible;
  $('#help-donate').hidden = !has;
  $('#helpToggleDonate').textContent = prefs.hideDonate ? 'Show donate link' : 'Hide donate link';
}
function openDonate(){ $('#supportDlg').showModal(); }
$('#donateLink').onclick = openDonate;
$('#helpOpenDonate').onclick = openDonate;
$('#hideDonate').onclick = () => { prefs.hideDonate = true; savePrefs(); syncDonate(); $('#supportDlg').close(); toast('Donate link hidden. You can bring it back in Help.'); };
$('#helpToggleDonate').onclick = () => { prefs.hideDonate = !prefs.hideDonate; savePrefs(); syncDonate(); toast(prefs.hideDonate ? 'Donate link hidden' : 'Donate link shown'); };
// ----- footer -----
$('#footVersion').textContent = `${APP_NAME} v${APP_VERSION}`;
if (GITHUB_URL){ $('#footGit').href = GITHUB_URL; $('#footGit').hidden = false; }
const wallets = CRYPTO_WALLETS.filter(w => w.address.trim());
if (wallets.length){
  $('#walletList').innerHTML = wallets.map((w, i) => {
    let qr = ''; try { qr = `<div class="wallet-qr" aria-label="QR code for the ${esc(w.label)} address">${QR.svg(w.address.trim())}</div>`; } catch {}
    return `<div class="wallet"><strong>${esc(w.label)}</strong>${qr}
    <code id="wallet-${i}">${esc(w.address.trim())}</code>
    <div class="actions"><button type="button" class="btn" data-copy="${i}">Copy address</button></div></div>`;
  }).join('');
}
syncDonate();
$('#footSupport').onclick = openDonate;
$('#walletList').addEventListener('click', async e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  const text = wallets[+b.dataset.copy].address.trim();
  try { await navigator.clipboard.writeText(text); }
  catch {                                    // older browsers / file pages: select the text and copy the old way
    const r = document.createRange(); r.selectNodeContents($(`#wallet-${b.dataset.copy}`));
    getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy');
  }
  b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy address', 1500);
});
load(); renderHome();
