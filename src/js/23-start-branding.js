/* ===================== Start ===================== */
document.title = APP_NAME;
const favicon = document.querySelector('link[rel="icon"]');
if (favicon) $('#brandLeaf').src = favicon.href; else $('#brandLeaf').remove();   // header logo reuses the favicon
