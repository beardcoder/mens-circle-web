/* Inlined in the <head> of every public page (Layout.astro, hashed for the CSP). */
// The upright faces are on every page and preloaded: load them while the page
// parses, so its first frame already sets them. Left to the first layout, they
// swap in a frame later and the whole page is styled and laid out again, during
// a page transition while the page slides in.
document.fonts.forEach((face) => {
  if (face.style === 'normal' && face.status === 'unloaded') face.load().catch(() => {});
});
