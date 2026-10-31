/**
 * The opening's beat (global.css, "Motion: the opening"). A title's words rise in
 * turn: each word gets its index (`--i`), and global.css starts word `i` at
 * 0.08 s + i × 0.07 s. The pieces after the title follow 0.15 s after the last word,
 * 0.12 s apart (`--enter-delay`). Wrapping happens on the server, so the lines break
 * the same with and without the motion; it splits on ordinary white space only, so a
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

/** `--enter-delay` for the `n`th piece (from 0) after a title of `count` words. */
export const afterWords = (count: number, n: number): string =>
  `--enter-delay: ${(0.08 + count * 0.07 + 0.15 + n * 0.12).toFixed(2)}s`;
