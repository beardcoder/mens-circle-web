<script lang="ts">
  import { isValidEmail } from '@lib/helpers';
  import { showToast } from '@lib/toast';
  import { trackEvent, TRACKING_EVENTS } from '@lib/umami';
  import { registerForEvent } from '@lib/pocketbase';
  import type { EventDTO } from '@lib/types';

  interface Props {
    event: EventDTO;
  }

  const { event }: Props = $props();

  let firstName = $state('');
  let lastName = $state('');
  let email = $state('');
  let phone = $state('');
  let privacy = $state(false);
  let submitting = $state(false);

  const submitLabel = $derived(
    event.is_full ? 'Auf Warteliste eintragen' : 'Verbindlich anmelden',
  );

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();

    const first = firstName.trim();
    const last = lastName.trim();
    const mail = email.trim();
    const tel = phone.trim();

    if (!first || !last) {
      showToast('error', 'Bitte fülle alle Pflichtfelder aus.');
      return;
    }

    if (!isValidEmail(mail)) {
      showToast('error', 'Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    if (!privacy) {
      showToast('error', 'Bitte bestätige die Datenschutzerklärung.');
      return;
    }

    trackEvent(TRACKING_EVENTS.EVENT_REGISTRATION_SUBMIT, {
      event_id: event.id,
      has_phone: tel ? 'yes' : 'no',
    });
    submitting = true;

    try {
      const { success, message } = await registerForEvent({
        event_id: event.id,
        first_name: first,
        last_name: last,
        email: mail,
        phone_number: tel || null,
        privacy: true,
      });

      if (success) {
        showToast('success', message);
        trackEvent(TRACKING_EVENTS.EVENT_REGISTRATION_SUCCESS);
        firstName = '';
        lastName = '';
        email = '';
        phone = '';
        privacy = false;
      } else {
        showToast('error', message);
        trackEvent(TRACKING_EVENTS.EVENT_REGISTRATION_ERROR, { error: message });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      showToast('error', 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      trackEvent(TRACKING_EVENTS.EVENT_REGISTRATION_ERROR, { error: msg });
    } finally {
      submitting = false;
    }
  }
</script>

<form
  class="event-register__form"
  autocomplete="on"
  onsubmit={handleSubmit}
>
  <div class="form-row">
    <div class="form-group">
      <label for="firstName">Vorname</label>
      <input
        type="text"
        id="firstName"
        name="first_name"
        placeholder="Dein Vorname"
        required
        autocomplete="given-name"
        bind:value={firstName}
        disabled={submitting}
      />
    </div>

    <div class="form-group">
      <label for="lastName">Nachname</label>
      <input
        type="text"
        id="lastName"
        name="last_name"
        placeholder="Dein Nachname"
        required
        autocomplete="family-name"
        bind:value={lastName}
        disabled={submitting}
      />
    </div>
  </div>

  <div class="form-group">
    <label for="email">E-Mail</label>
    <input
      type="email"
      id="email"
      name="email"
      placeholder="deine@email.de"
      required
      autocomplete="email"
      inputmode="email"
      bind:value={email}
      disabled={submitting}
    />
  </div>

  <div class="form-group">
    <label for="phone"
      >Handynummer
      <span class="form-label-optional">(optional)</span></label
    >
    <input
      type="tel"
      id="phone"
      name="phone_number"
      placeholder="+49 170 1234567"
      autocomplete="tel"
      inputmode="tel"
      bind:value={phone}
      disabled={submitting}
    />
    <span class="form-helper">Für Erinnerungen per SMS am Veranstaltungstag</span>
  </div>

  <label class="form-checkbox">
    <input type="checkbox" name="privacy" required bind:checked={privacy} disabled={submitting} />
    <span
      >Ich habe die
      <a href="/datenschutz" target="_blank">Datenschutzerklärung</a>
      gelesen und stimme der Verarbeitung meiner Daten zu.</span
    >
  </label>

  <button
    type="submit"
    class="btn btn--primary btn--large event-register__submit"
    disabled={submitting}
  >
    {submitting ? 'Wird gesendet...' : submitLabel}
  </button>
</form>
