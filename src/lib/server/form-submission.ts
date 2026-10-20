/** The answer every public form handler gives: an HTTP status plus the message the visitor reads. */
export interface FormResult {
  status: number;
  body: { success: boolean; message: string };
}

export const accepted = (message: string): FormResult => ({ status: 200, body: { success: true, message } });

export const rejected = (status: number, message: string): FormResult => ({
  status,
  body: { success: false, message },
});
