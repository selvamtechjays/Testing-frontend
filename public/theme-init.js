// Sets the saved theme before first paint so the page never flashes the wrong one.
// Loaded as a plain synchronous script so it also works under a `script-src 'self'` policy.
// Keep the storage key and the allowed values in step with src/lib/theme.ts
// (a unit test, src/lib/theme.test.ts, fails if they drift).
try {
  var saved = localStorage.getItem('tasknest-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch (e) {
  // storage blocked: the device theme applies
}
