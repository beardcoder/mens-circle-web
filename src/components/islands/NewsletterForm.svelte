<script lang="ts">
  import { isValidEmail } from '@lib/helpers';
  import { subscribeNewsletter } from '@lib/api';
  import { showToast } from '@lib/toast';
  import { TRACKING_EVENTS, trackEvent } from '@lib/umami';
  import { describedBy, errorId, focusFirstInvalid, takeOverValidation } from '@lib/form-errors';

  interface Props {
    /** Optional analytics context merged into tracking events. */
    context?: Record<string, string | number | boolean>;
    /** Distinguishes the error element's id when a page renders two of these. */
    formId?: string;
  }

  const { context = {}, formId = 'newsletter' }: Props = $props();

  let email = $state('');
  let website = $state(''); // honeypot — bots fill it, humans never see it
  let submitting = $state(false);
  let error = $state('');
  let formEl: HTMLFormElement | undefined = $state();

  $effect(() => {
    takeOverValidation(formEl);
  });

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const value = email.trim();

    error = !value
      ? 'Bitte gib deine E-Mail-Adresse an.'
      : !isValidEmail(value)
        ? 'Diese E-Mail-Adresse sieht nicht gültig aus.'
        : '';

    if (error) {
      // The inline message carries the detail; the toast is only the summary.
      showToast('error', error);
      await focusFirstInvalid(formEl);
      return;
    }

    trackEvent(TRACKING_EVENTS.NEWSLETTER_SUBMIT, context);
    submitting = true;

    try {
      const { success, message } = await subscribeNewsletter(value, website);

      if (success) {
        showToast('success', message);
        trackEvent(TRACKING_EVENTS.NEWSLETTER_SUCCESS, context);
        email = '';
        error = '';
      } else {
        showToast('error', message);
        trackEvent(TRACKING_EVENTS.NEWSLETTER_ERROR, {
          ...context,
          error: message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      showToast('error', 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      trackEvent(TRACKING_EVENTS.NEWSLETTER_ERROR, {
        ...context,
        error: message,
      });
    } finally {
      submitting = false;
    }
  }
</script>

<!-- Validation is taken over from the browser at hydration (see
     takeOverValidation) so a rejected address is explained in place instead of
     in a browser bubble that vanishes on blur. -->
<form bind:this={formEl} class="newsletter__form" onsubmit={handleSubmit}>
  <div class="hp-field" aria-hidden="true">
    <label>
      Website
      <input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} />
    </label>
  </div>

  <!-- A real, visible <label>, not an aria-label over a placeholder: the
       placeholder disappears the moment you type, and a screen-reader-only name
       leaves sighted users with nothing to click. `formId` keeps the id unique
       when a page renders this island twice. -->
  <div class="newsletter__field">
    <label class="form-label" for={`${formId}-email`}>E-Mail-Adresse</label>
    <input
      id={`${formId}-email`}
      type="email"
      name="email"
      placeholder="name@beispiel.de"
      required
      class="newsletter__input"
      autocomplete="email"
      inputmode="email"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy(formId, 'email', !!error)}
      bind:value={email}
      oninput={() => (error = '')}
      disabled={submitting}
    />
  </div>

  <button type="submit" class="btn btn--primary" disabled={submitting}>
    {submitting ? 'Wird gesendet …' : 'Anmelden'}
  </button>
</form>
{#if error}
  <span class="form-error newsletter__error" id={errorId(formId, 'email')}>{error}</span>
{/if}
