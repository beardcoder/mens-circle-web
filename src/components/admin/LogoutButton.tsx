import { actions } from 'astro:actions';
import { useState } from 'preact/hooks';

import { button } from '@lib/ui';

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <div class="grid justify-items-end gap-2">
      <button
        type="button"
        disabled={busy}
        class={button({ variant: 'secondary', size: 'sm' })}
        onClick={async () => {
          if (
            document.querySelector('[data-unsaved="true"]') &&
            !confirm('Ungespeicherte Änderungen verwerfen und abmelden?')
          )
            return;

          setBusy(true);
          setError('');

          try {
            const result = await actions.logout();

            if (result.error) throw new Error(result.error.message);

            window.dispatchEvent(new Event('admin:discard'));
            window.location.replace('/admin/login');
          } catch {
            setError('Abmelden fehlgeschlagen. Bitte erneut versuchen.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Abmelden …' : 'Abmelden'}
      </button>
      {error && (
        <p role="alert" class="max-w-64 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
