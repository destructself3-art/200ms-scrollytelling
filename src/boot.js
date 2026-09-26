/* Entry point: every module above has registered itself on window.APP. */
(() => {
  'use strict';
  try { window.APP.boot(); } catch (e) { console.error('boot failed', e); }
})();
