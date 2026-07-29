<script lang="ts">
  import { isValidEmail } from '@lib/helpers';
  import { submitTestimonial } from '@lib/api';
  import { showToast } from '@lib/toast';
  import { TRACKING_EVENTS, trackEvent } from '@lib/umami';
  import {
    describedBy,
    errorId,
    type FieldErrors,
    firstError,
    focusFirstInvalid,
    takeOverValidation,
  } from '@lib/form-errors';

  const FORM = 'testimonial';

  let quote = $state('');
  let authorName = $state('');
  let role = $state('');
  let email = $state('');
  let privacy = $state(false);
  let website = $state(''); // honeypot
  let submitting = $state(false);
  let errors = $state<FieldErrors>({});
  let formEl: HTMLFormElement | undefined = $state();

  const charCount = $derived(quote.length);

  $effect(() => {
    takeOverValidation(formEl);
  });

  function clearError(field: string): void {
    if (errors[field]) {
      const { [field]: _removed, ...rest } = errors;
      errors = rest;
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const text = quote.trim();

    if (!text) next.quote = 'Bitte teile deine Erfahrung mit uns.';
    else if (text.length < 10) next.quote = `Noch etwas mehr, bitte — mindestens 10 Zeichen (aktuell ${text.length}).`;
    else if (text.length > 1000) next.quote = 'Bitte kürze deinen Text auf maximal 1000 Zeichen.';

    if (!email.trim()) next.email = 'Bitte gib deine E-Mail-Adresse an.';
    else if (!isValidEmail(email.trim())) next.email = 'Diese E-Mail-Adresse sieht nicht gültig aus.';

    if (!privacy) next.privacy = 'Bitte bestätige die Datenschutzerklärung.';

    return next;
  }

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();

    errors = validate();

    if (Object.keys(errors).length > 0) {
      // The inline messages carry the detail; the toast is only the summary.
      showToast('error', firstError(errors) ?? 'Bitte prüfe deine Eingaben.');
      await focusFirstInvalid(formEl);
      return;
    }

    const text = quote.trim();
    const name = authorName.trim();
    const roleValue = role.trim();
    const mail = email.trim();

    trackEvent(TRACKING_EVENTS.TESTIMONIAL_SUBMIT, {
      has_name: name ? 'yes' : 'no',
      has_role: roleValue ? 'yes' : 'no',
      char_count: text.length,
    });
    submitting = true;

    try {
      const { success, message } = await submitTestimonial({
        quote: text,
        author_name: name || null,
        role: roleValue || null,
        email: mail,
        privacy: true,
        website,
      });

      if (success) {
        showToast('success', message);
        trackEvent(TRACKING_EVENTS.TESTIMONIAL_SUCCESS);
        quote = '';
        authorName = '';
        role = '';
        email = '';
        privacy = false;
        errors = {};
      } else {
        showToast('error', message);
        trackEvent(TRACKING_EVENTS.TESTIMONIAL_ERROR, { error: message });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Network error';
      showToast('error', 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      trackEvent(TRACKING_EVENTS.TESTIMONIAL_ERROR, { error: msg });
    } finally {
      submitting = false;
    }
  }
</script>

<!-- Validation is taken over from the browser at hydration (see
     takeOverValidation) so every problem is explained in place, all at once,
     instead of one browser bubble at a time. -->
<form bind:this={formEl} class="testimonial-form" onsubmit={handleSubmit}>
  <div class="hp-field" aria-hidden="true">
    <label>
      Website
      <input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} />
    </label>
  </div>
  <div class="form-field form-field--spaced">
    <label for="quote" class="form-label form-label--plain">
      Deine Erfahrung <span class="form-required">*</span>
    </label>
    <textarea
      id="quote"
      name="quote"
      class="form-control form-control--light"
      rows="6"
      placeholder="z.B. &quot;Hier kann ich endlich ich selbst sein, ohne Maske und ohne Leistungsdruck...&quot;"
      required
      minlength="10"
      maxlength="1000"
      aria-invalid={errors.quote ? 'true' : undefined}
      aria-describedby={describedBy(FORM, 'quote', !!errors.quote, 'testimonial-quote-hint')}
      bind:value={quote}
      oninput={() => clearError('quote')}
      disabled={submitting}></textarea>
    <span class="form-hint" id="testimonial-quote-hint">Mindestens 10 Zeichen, maximal 1000 Zeichen</span>
    {#if errors.quote}
      <span class="form-error" id={errorId(FORM, 'quote')}>{errors.quote}</span>
    {/if}
    <span class="testimonial-form__counter">
      <span class="char-count">{charCount}</span>/1000
    </span>
  </div>

  <div class="form-field form-field--spaced">
    <label for="author_name" class="form-label form-label--plain">
      Dein Name <span class="form-optional">(optional)</span>
    </label>
    <input
      type="text"
      id="author_name"
      name="author_name"
      class="form-control form-control--light"
      placeholder="z.B. Michael oder anonym lassen"
      maxlength="255"
      bind:value={authorName}
      disabled={submitting}
    />
    <span class="form-hint">Leer lassen für ein anonymes Testimonial</span>
  </div>

  <div class="form-field form-field--spaced">
    <label for="role" class="form-label form-label--plain">
      Rolle/Beschreibung <span class="form-optional">(optional)</span>
    </label>
    <input
      type="text"
      id="role"
      name="role"
      class="form-control form-control--light"
      placeholder="z.B. Teilnehmer seit 2023"
      maxlength="255"
      bind:value={role}
      disabled={submitting}
    />
  </div>

  <div class="form-field form-field--spaced">
    <label for="testimonial_email" class="form-label form-label--plain">
      E-Mail-Adresse <span class="form-required">*</span>
    </label>
    <input
      type="email"
      id="testimonial_email"
      name="email"
      class="form-control form-control--light"
      placeholder="deine@email.de"
      required
      maxlength="255"
      aria-invalid={errors.email ? 'true' : undefined}
      aria-describedby={describedBy(FORM, 'email', !!errors.email, 'testimonial-email-hint')}
      bind:value={email}
      oninput={() => clearError('email')}
      disabled={submitting}
    />
    <span class="form-hint" id="testimonial-email-hint">Wird nicht veröffentlicht. Nur für Rückfragen.</span>
    {#if errors.email}
      <span class="form-error" id={errorId(FORM, 'email')}>{errors.email}</span>
    {/if}
  </div>

  <div class="form-field form-field--checkbox">
    <label class="form-checkbox-label">
      <input
        type="checkbox"
        name="privacy"
        class="form-checkbox-control"
        required
        aria-invalid={errors.privacy ? 'true' : undefined}
        aria-describedby={describedBy(FORM, 'privacy', !!errors.privacy)}
        bind:checked={privacy}
        onchange={() => clearError('privacy')}
        disabled={submitting}
      />
      <span class="form-checkbox-text">
        Ich habe die
        <a href="/datenschutz" target="_blank" rel="noopener" class="link"
          >Datenschutzerklärung<span class="sr-only"> (öffnet in neuem Tab)</span></a
        >
        zur Kenntnis genommen und bin damit einverstanden, dass meine Daten zum Zwecke der Veröffentlichung gespeichert werden.
        <span class="form-required">*</span>
      </span>
    </label>
    {#if errors.privacy}
      <span class="form-error" id={errorId(FORM, 'privacy')}>{errors.privacy}</span>
    {/if}
  </div>

  <div class="form-actions">
    <button type="submit" class="btn btn--primary" disabled={submitting}>
      {submitting ? 'Wird gesendet...' : 'Erfahrung teilen'}
    </button>
  </div>

  <p class="testimonial-form__note">
    <small>
      Alle Felder mit <span class="form-required">*</span> sind Pflichtfelder.<br />
      Dein Testimonial wird nach Prüfung durch uns veröffentlicht.
    </small>
  </p>
</form>
