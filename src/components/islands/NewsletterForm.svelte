<script lang="ts">
  import { isValidEmail } from '@lib/helpers';
  import { subscribeNewsletter } from '@lib/api';
  import { TRACKING_EVENTS, type UmamiEventData } from '@lib/umami';
  import { describedBy, errorId, type FieldErrors, submitForm, takeOverValidation } from '@lib/form';

  interface Props {
    /** Optional analytics context merged into tracking events. */
    context?: UmamiEventData;
    /** Distinguishes the error element's id when a page renders two of these. */
    formId?: string;
  }

  const { context = {}, formId = 'newsletter' }: Props = $props();

  let email = $state('');
  let website = $state(''); // honeypot — bots fill it, humans never see it
  let submitting = $state(false);
  let errors = $state<FieldErrors>({});
  let formEl: HTMLFormElement | undefined = $state();

  $effect(() => {
    takeOverValidation(formEl);
  });

  function validate(): FieldErrors {
    const value = email.trim();
    if (!value) return { email: 'Bitte gib deine E-Mail-Adresse an.' };
    if (!isValidEmail(value)) return { email: 'Diese E-Mail-Adresse sieht nicht gültig aus.' };
    return {};
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    await submitForm({
      form: formEl,
      validate,
      setErrors: (next) => (errors = next),
      setSubmitting: (value) => (submitting = value),
      events: {
        submit: TRACKING_EVENTS.NEWSLETTER_SUBMIT,
        success: TRACKING_EVENTS.NEWSLETTER_SUCCESS,
        error: TRACKING_EVENTS.NEWSLETTER_ERROR,
      },
      context,
      send: () => subscribeNewsletter(email.trim(), website),
      reset: () => (email = ''),
    });
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
      aria-invalid={errors.email ? 'true' : undefined}
      aria-describedby={describedBy(formId, 'email', !!errors.email)}
      bind:value={email}
      oninput={() => (errors = {})}
      disabled={submitting}
    />
  </div>

  <button type="submit" class="btn btn--primary" disabled={submitting}>
    {submitting ? 'Wird gesendet …' : 'Anmelden'}
  </button>
</form>
{#if errors.email}
  <span class="form-error newsletter__error" id={errorId(formId, 'email')}>{errors.email}</span>
{/if}
