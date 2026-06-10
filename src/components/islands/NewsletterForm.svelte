<script lang="ts">
  import { isValidEmail } from '@lib/helpers';
  import { showToast } from '@lib/toast';
  import { trackEvent, TRACKING_EVENTS } from '@lib/umami';
  import { subscribeNewsletter } from '@lib/pocketbase';

  interface Props {
    /** Optional analytics context merged into tracking events. */
    context?: Record<string, string | number | boolean>;
  }

  const { context = {} }: Props = $props();

  let email = $state('');
  let website = $state(''); // honeypot — bots fill it, humans never see it
  let submitting = $state(false);

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    const value = email.trim();

    if (!isValidEmail(value)) {
      showToast('error', 'Bitte gib eine gültige E-Mail-Adresse ein.');
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
      } else {
        showToast('error', message);
        trackEvent(TRACKING_EVENTS.NEWSLETTER_ERROR, {
          ...context,
          error: message,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Network error';
      showToast('error', 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      trackEvent(TRACKING_EVENTS.NEWSLETTER_ERROR, { ...context, error: message });
    } finally {
      submitting = false;
    }
  }
</script>

<form class="newsletter__form" onsubmit={handleSubmit}>
  <div class="hp-field" aria-hidden="true">
    <label>
      Website
      <input
        type="text"
        name="website"
        tabindex="-1"
        autocomplete="off"
        bind:value={website}
      />
    </label>
  </div>
  <input
    type="email"
    name="email"
    placeholder="Deine E-Mail-Adresse"
    required
    class="newsletter__input"
    aria-label="E-Mail-Adresse"
    autocomplete="email"
    inputmode="email"
    bind:value={email}
    disabled={submitting}
  />
  <button type="submit" class="btn btn--primary" disabled={submitting}>
    {submitting ? 'Wird gesendet...' : 'Anmelden'}
  </button>
</form>
