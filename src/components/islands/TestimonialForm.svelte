<script lang="ts">
  import { isValidEmail } from '@lib/helpers';
  import { showToast } from '@lib/toast';
  import { trackEvent, TRACKING_EVENTS } from '@lib/umami';
  import { submitTestimonial } from '@lib/pocketbase';

  let quote = $state('');
  let authorName = $state('');
  let role = $state('');
  let email = $state('');
  let privacy = $state(false);
  let submitting = $state(false);

  const charCount = $derived(quote.length);

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();

    const text = quote.trim();
    const name = authorName.trim();
    const roleValue = role.trim();
    const mail = email.trim();

    if (!text || text.length < 10) {
      showToast(
        'error',
        'Bitte teile deine Erfahrung mit uns (mindestens 10 Zeichen).',
      );
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
      });

      if (success) {
        showToast('success', message);
        trackEvent(TRACKING_EVENTS.TESTIMONIAL_SUCCESS);
        quote = '';
        authorName = '';
        role = '';
        email = '';
        privacy = false;
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

<form class="testimonial-form" onsubmit={handleSubmit}>
  <div class="form-field form-field--spaced">
    <label for="quote" class="form-label form-label--plain">
      Deine Erfahrung <span class="form-required">*</span>
    </label>
    <textarea
      id="quote"
      name="quote"
      class="form-control form-control--light"
      rows="6"
      placeholder={'z.B. "Hier kann ich endlich ich selbst sein, ohne Maske und ohne Leistungsdruck..."'}
      required
      minlength="10"
      maxlength="1000"
      bind:value={quote}
      disabled={submitting}
    ></textarea>
    <span class="form-hint">Mindestens 10 Zeichen, maximal 1000 Zeichen</span>
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
      bind:value={email}
      disabled={submitting}
    />
    <span class="form-hint">Wird nicht veröffentlicht. Nur für Rückfragen.</span>
  </div>

  <div class="form-field form-field--checkbox">
    <label class="form-checkbox-label">
      <input
        type="checkbox"
        name="privacy"
        class="form-checkbox-control"
        required
        bind:checked={privacy}
        disabled={submitting}
      />
      <span class="form-checkbox-text">
        Ich habe die
        <a href="/datenschutz" target="_blank" class="link">Datenschutzerklärung</a>
        zur Kenntnis genommen und bin damit einverstanden, dass meine Daten zum
        Zwecke der Veröffentlichung gespeichert werden.
        <span class="form-required">*</span>
      </span>
    </label>
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
