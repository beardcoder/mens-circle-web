/**
 * The answer every public form handler gives: an HTTP status plus the message
 * the visitor reads. Field validation happens earlier, in the actions' schemas
 * (src/actions/index.ts); these are the rejections only the data can decide —
 * a past event, a seat already taken, an address already subscribed.
 */
export interface FormResult {
  status: number;
  body: { success: boolean; message: string };
}

export const accepted = (message: string): FormResult => ({ status: 200, body: { success: true, message } });

export const rejected = (status: number, message: string): FormResult => ({
  status,
  body: { success: false, message },
});

/**
 * The honeypot was filled. Callers answer with the success a real visitor would
 * have got — an error names the field that gave it away — and store nothing.
 */
export const isHoneypotFilled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
