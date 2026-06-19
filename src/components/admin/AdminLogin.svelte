<script lang="ts">
  import { adminApi } from '@lib/admin-client';

  interface Props {
    redirect?: string;
  }
  const { redirect = '/admin' }: Props = $props();

  let email = $state('');
  let password = $state('');
  let submitting = $state(false);
  let error = $state('');

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    error = '';
    submitting = true;
    const res = await adminApi.post('/api/admin/login', { email: email.trim(), password });
    submitting = false;
    if (res.success) {
      window.location.href = redirect;
    } else {
      error = res.message;
    }
  }
</script>

<form class="admin-card login-card" onsubmit={handleSubmit}>
  <h1>Anmeldung</h1>
  {#if error}
    <div class="admin-toast admin-toast--err">{error}</div>
  {/if}
  <div class="field">
    <label for="email">E-Mail</label>
    <input id="email" type="email" autocomplete="username" bind:value={email} required disabled={submitting} />
  </div>
  <div class="field">
    <label for="password">Passwort</label>
    <input
      id="password"
      type="password"
      autocomplete="current-password"
      bind:value={password}
      required
      disabled={submitting}
    />
  </div>
  <button class="admin-btn" type="submit" disabled={submitting}>
    {submitting ? 'Anmelden…' : 'Anmelden'}
  </button>
</form>

<style>
  .login-card {
    max-width: 360px;
    margin: 4rem auto 0;
  }
  .field {
    margin-bottom: 1rem;
  }
</style>
