import { isInputError } from 'astro:actions';
import { useRef, useState } from 'preact/hooks';

export interface Notice {
  tone: 'success' | 'error' | 'warning';
  text: string;
  login?: boolean;
}

type ActionResult<T> = { data?: T; error?: { message: string; code?: string } };

/** Shared request state, not a store: each workspace owns its data. */
export function useAdminTask() {
  const lock = useRef(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState(0);

  async function run<T extends object>(
    key: string,
    request: () => Promise<ActionResult<T>>,
    after?: (data: T) => void | Promise<void>,
  ) {
    if (lock.current) return;

    lock.current = true;
    setBusy(key);
    setNotice(null);
    setFields({});

    try {
      const result = await request();

      if (result.error) {
        const inputError = isInputError(result.error) ? result.error : null;

        if (inputError) setValidation((current) => current + 1);

        setFields(
          inputError
            ? Object.fromEntries(
                Object.entries(inputError.fields).map(([name, messages]) => [name, messages?.[0] ?? '']),
              )
            : {},
        );
        setNotice({
          tone: 'error',
          text: inputError ? 'Bitte prüfe die markierten Angaben.' : result.error.message,
          login: result.error.code === 'UNAUTHORIZED',
        });

        return;
      }

      if (!result.data) throw new Error('Missing response');

      setNotice(actionNotice(result.data));

      try {
        await after?.(result.data);
      } catch {
        setNotice({
          tone: 'warning',
          text: 'Vorgang abgeschlossen. Die Ansicht konnte nicht aktualisiert werden. Bitte lade sie neu.',
        });
      }

      return result.data;
    } catch {
      setNotice({
        tone: 'error',
        text: 'Keine zuverlässige Antwort vom Server. Prüfe den aktuellen Stand, bevor du den Vorgang erneut ausführst.',
      });
    } finally {
      lock.current = false;
      setBusy('');
    }
  }

  const clearField = (name: string) => setFields((current) => ({ ...current, [name]: '' }));

  return { busy, notice, fields, validation, setNotice, clearField, run };
}

function actionNotice(data: object): Notice | null {
  if (!('message' in data) || typeof data.message !== 'string') return null;

  const failed = 'failed' in data && Number(data.failed) > 0;
  const partial = 'sent' in data && 'total' in data && Number(data.sent) < Number(data.total);

  return { text: data.message, tone: failed || partial ? 'warning' : 'success' };
}
