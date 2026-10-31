/**
 * Wraps each word of a title in its own box, so the words can rise in one after
 * the other (`components/Motion.astro`). Splits on ordinary white space only: a
 * no-break space keeps a dash bound to its word, and tags pass through untouched.
 * Done on the server, so the lines break the same before and after the script.
 */
const WORD = '<span data-word class="inline-block">$&</span>';

/** Word boxes for a title given as HTML (a rendered slot). */
export const splitWords = (html: string): string =>
  html
    .trim()
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(/[^ \t\n\r]+/g, WORD)))
    .join('');

/** Word boxes for a plain-text title (escaped first). */
export const splitText = (text: string): string =>
  splitWords(text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
