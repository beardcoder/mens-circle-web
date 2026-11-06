/** "Musterstraße 1, 94315 Straubing", from whichever parts are set. */
export const fullAddress = (ev: { street: string; postalCode: string; city: string }): string =>
  [ev.street, [ev.postalCode, ev.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
