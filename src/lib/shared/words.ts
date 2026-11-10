/**
 * The opening's beat (global.css, "Motion: the opening"). The title rises in as
 * one; the pieces after it follow closely, 0.08 s apart (`--enter-delay`), so the
 * largest paint of a phone (the lead under the title) is never held back. Titles
 * are still wrapped word by word on the server (each word a box with its index):
 * the lines break the same everywhere; it splits on ordinary white space only, so a
 * no-break space keeps a dash bound to its word, and tags pass through untouched.
 */
export interface Words {
  html: string;
  count: number;
}

/** Word boxes for a title given as HTML (a rendered slot). */
export const splitWords = (html: string): Words => {
  let count = 0;

  const wrapped = html
    .trim()
    .split(/(<[^>]+>)/)
    .map((part) =>
      part.startsWith('<')
        ? part
        : part.replace(
            /[^ \t\n\r]+/g,
            (word) => `<span data-word class="inline-block" style="--i: ${count++}">${word}</span>`,
          ),
    )
    .join('');

  return { html: wrapped, count };
};

/** Word boxes for a plain-text title (escaped first). */
export const splitText = (text: string): Words =>
  splitWords(text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));

/** `--enter-delay` for the `n`th piece (from 0) after a title; the title's length does not delay it. */
export const afterWords = (_count: number, n: number): string => `--enter-delay: ${(0.08 + n * 0.08).toFixed(2)}s`;

/**
 * A title as its lead and its last word, which pages set in the accent, the way an
 * `<em>` does in the home opening ("Männerkreis in" / "Straubing"). A one-word title
 * has no accent. Content never decides layout: every title is set the same way.
 */
export const accentLastWord = (title: string): { lead: string; accent: string } => {
  const text = title.trim();
  const at = text.lastIndexOf(' ');

  return at < 0 ? { lead: text, accent: '' } : { lead: text.slice(0, at), accent: text.slice(at + 1) };
};
