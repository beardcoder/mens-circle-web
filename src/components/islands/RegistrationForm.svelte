<script lang="ts">
  import { isValidEmail } from '@lib/helpers';
  import { registerForEvent } from '@lib/api';
  import type { EventDTO } from '@lib/types';
  import { TRACKING_EVENTS } from '@lib/umami';
  import { describedBy, errorId, type FieldErrors, submitForm, takeOverValidation, withoutError } from '@lib/form';

  interface Props {
    event: Pick<EventDTO, 'id' | 'is_full'>;
  }

  const { event }: Props = $props();

  const FORM = 'register';

  let firstName = $state('');
  let lastName = $state('');
  let email = $state('');
  let phone = $state('');
  let privacy = $state(false);
  let website = $state(''); // honeypot
  let submitting = $state(false);
  let errors = $state<FieldErrors>({});
  let formEl: HTMLFormElement | undefined = $state();

  const submitLabel = $derived(event.is_full ? 'Auf Warteliste eintragen' : 'Verbindlich anmelden');

  $effect(() => {
    takeOverValidation(formEl);
  });

  const clearError = (field: string): void => {
    errors = withoutError(errors, field);
  };

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (!firstName.trim()) next.firstName = 'Bitte gib deinen Vornamen an.';
    if (!lastName.trim()) next.lastName = 'Bitte gib deinen Nachnamen an.';
    if (!email.trim()) next.email = 'Bitte gib deine E-Mail-Adresse an.';
    else if (!isValidEmail(email.trim())) next.email = 'Diese E-Mail-Adresse sieht nicht gültig aus.';
    if (!privacy) next.privacy = 'Bitte bestätige die Datenschutzerklärung.';

    return next;
  }

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();

    await submitForm({
      form: formEl,
      validate,
      setErrors: (next) => (errors = next),
      setSubmitting: (value) => (submitting = value),
      events: {
        submit: TRACKING_EVENTS.EVENT_REGISTRATION_SUBMIT,
        success: TRACKING_EVENTS.EVENT_REGISTRATION_SUCCESS,
        error: TRACKING_EVENTS.EVENT_REGISTRATION_ERROR,
      },
      context: { event_id: event.id, has_phone: phone.trim() ? 'yes' : 'no' },
      send: () =>
        registerForEvent({
          event_id: event.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone_number: phone.trim() || null,
          privacy: true,
          website,
        }),
      reset: () => {
        firstName = '';
        lastName = '';
        email = '';
        phone = '';
        privacy = false;
      },
    });
  }
</script>

<!-- Validation is taken over from the browser at hydration, not in the markup —
     see takeOverValidation(). The browser's own bubbles stop at the first field,
     can't be styled and vanish on blur; we surface every problem at once, in
     place, and keep it there. The `required` attributes stay: they carry the
     semantics assistive tech announces, and they guard the pre-hydration gap. -->
<form bind:this={formEl} class="event-register__form" autocomplete="on" onsubmit={handleSubmit}>
  <div class="hp-field" aria-hidden="true">
    <label>
      Website
      <input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} />
    </label>
  </div>
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
        aria-invalid={errors.firstName ? 'true' : undefined}
        aria-describedby={describedBy(FORM, 'firstName', !!errors.firstName)}
        bind:value={firstName}
        oninput={() => clearError('firstName')}
        disabled={submitting}
      />
      {#if errors.firstName}
        <span class="form-error" id={errorId(FORM, 'firstName')}>{errors.firstName}</span>
      {/if}
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
        aria-invalid={errors.lastName ? 'true' : undefined}
        aria-describedby={describedBy(FORM, 'lastName', !!errors.lastName)}
        bind:value={lastName}
        oninput={() => clearError('lastName')}
        disabled={submitting}
      />
      {#if errors.lastName}
        <span class="form-error" id={errorId(FORM, 'lastName')}>{errors.lastName}</span>
      {/if}
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
      aria-invalid={errors.email ? 'true' : undefined}
      aria-describedby={describedBy(FORM, 'email', !!errors.email)}
      bind:value={email}
      oninput={() => clearError('email')}
      disabled={submitting}
    />
    {#if errors.email}
      <span class="form-error" id={errorId(FORM, 'email')}>{errors.email}</span>
    {/if}
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
      aria-describedby="register-phone-hint"
      bind:value={phone}
      disabled={submitting}
    />
    <span class="form-helper" id="register-phone-hint">
      Falls wir dich am Veranstaltungstag kurzfristig erreichen müssen
    </span>
  </div>

  <div class="form-group">
    <label class="form-checkbox">
      <input
        type="checkbox"
        name="privacy"
        required
        aria-invalid={errors.privacy ? 'true' : undefined}
        aria-describedby={describedBy(FORM, 'privacy', !!errors.privacy)}
        bind:checked={privacy}
        onchange={() => clearError('privacy')}
        disabled={submitting}
      />
      <span
        >Ich habe die
        <a href="/datenschutz" target="_blank" rel="noopener"
          >Datenschutzerklärung<span class="sr-only"> (öffnet in neuem Tab)</span></a
        >
        gelesen und stimme der Verarbeitung meiner Daten zu.</span
      >
    </label>
    {#if errors.privacy}
      <span class="form-error" id={errorId(FORM, 'privacy')}>{errors.privacy}</span>
    {/if}
  </div>

  <button type="submit" class="btn btn--primary btn--large event-register__submit" disabled={submitting}>
    {submitting ? 'Wird gesendet...' : submitLabel}
  </button>
</form>
