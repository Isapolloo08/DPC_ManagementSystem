import { createMemoryStorage, demoToken, guideSandbox } from './runtime';

// Imported before App: this document never reads the real login or preferences.
// Each iframe has its own JS realm, API cache, storage and sample database.
if (guideSandbox) {
  Object.defineProperty(window, 'localStorage', { value: createMemoryStorage({
    chms_token: demoToken, dpc_theme_mode: guideSandbox.theme,
    [`dpc_help_welcome_v1:9901:${guideSandbox.role}`]: 'seen',
  }), configurable: false });
  Object.defineProperty(window, 'sessionStorage', { value: createMemoryStorage({ dpc_intro_shown: 'true' }), configurable: false });
  window.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('bible-api.com/')) return new Response(JSON.stringify({
      reference: 'Sample passage', verses: [{ verse: 1, text: 'Sample Scripture passage for practicing the reader controls.' }],
    }), { headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/attendance-log/export.csv')) return new Response('Member,Status\nAna Sample,Present\n', { headers: { 'Content-Type': 'text/csv' } });
    // Direct fetches outside the shared API must also fail closed.
    throw new Error('Practice mode uses sample data only. External requests are unavailable.');
  };
  XMLHttpRequest.prototype.open = () => { throw new Error('Network requests are unavailable in practice mode.'); };
  navigator.sendBeacon = () => false;
  // React form handlers still run, but native form navigation can never send data.
  document.addEventListener('submit', event => event.preventDefault(), true);
}
