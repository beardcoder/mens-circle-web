/** HTML escaping; pure, shared by pages and mails. */
export const escapeHtml = (str: unknown): string => {
  if (str === undefined || str === null) return ''

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
