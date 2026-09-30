// Apply before the first paint. Keep the key and 6 AM / 6 PM schedule in sync
// with ThemeContext, which handles changes after React starts.
(function () {
  var mode = 'auto';
  try {
    var saved = localStorage.getItem('dpc_theme_mode');
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch (_) {}
  var hour = new Date().getHours();
  var resolved = mode === 'auto' ? (hour >= 6 && hour < 18 ? 'light' : 'dark') : mode;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
})();
