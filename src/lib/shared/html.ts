/** Escaping and the admin's plain text as HTML; pure, shared by pages and mails. */
export const escapeHtml = (str: unknown): string => {
  if (str === undefined || str === null) return '';

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const LIST_ITEM = /^\s*[-–•*]\s+(.+)$/;

/**
 * The admin's plain text as HTML: blank lines part paragraphs, line breaks stay
 * breaks, and lines that start with "- ", "– ", "• " or "* " become a real list.
 * Everything is escaped first.
 */
export const plainTextToHtml = (text: string): string => {
  const html: string[] = [];
  let lines: string[] = [];
  let items: string[] = [];

  const flushLines = (): void => {
    if (lines.length) html.push(`<p>${lines.join('<br />')}</p>`);

    lines = [];
  };

  const flushItems = (): void => {
    if (items.length) html.push(`<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`);

    items = [];
  };

  for (const raw of escapeHtml(text.trim()).split(/\r\n|\r|\n/)) {
    const item = LIST_ITEM.exec(raw);

    if (item) {
      flushLines();
      items.push(item[1].trim());
    } else if (raw.trim() === '') {
      flushLines();
      flushItems();
    } else {
      flushItems();
      lines.push(raw.trim());
    }
  }

  flushLines();
  flushItems();

  return html.join('');
};
