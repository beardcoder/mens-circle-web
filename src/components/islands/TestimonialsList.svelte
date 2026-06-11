<script lang="ts">
  import { onMount } from 'svelte';
  import { getTestimonials } from '@lib/pocketbase';
  import type { Testimonial } from '@lib/types';

  interface Props {
    anchor?: string;
  }

  const { anchor = 'stimmen' }: Props = $props();

  let testimonials = $state<Testimonial[]>([]);
  let loaded = $state(false);

  onMount(async () => {
    testimonials = await getTestimonials();
    loaded = true;
  });
</script>

{#if loaded && testimonials.length > 0}
  <section
    class="section section--large testimonials-section"
    id={anchor}
    aria-labelledby="testimonials-title"
  >
    <div class="testimonials__pattern" aria-hidden="true"></div>
    <div class="container">
      <div class="section-header">
        <p class="eyebrow">Community Stimmen</p>
        <h2 class="section-title" id="testimonials-title">
          Was <span class="highlight">Teilnehmer</span> sagen
        </h2>
        <p class="testimonials__subtitle">
          Authentische Einblicke von Männern, die den Kreis erleben
        </p>
      </div>

      <div class="testimonials__grid">
        {#each testimonials as t}
          <article class="testimonial-item" data-hover="lift">
            <blockquote class="testimonial-item__quote">{t.quote}</blockquote>
            {#if t.author || t.role}
              <div class="testimonial-item__author">
                {#if t.author}
                  <cite class="testimonial-item__name">{t.author}</cite>
                {/if}
                {#if t.role}
                  <span class="testimonial-item__role">{t.role}</span>
                {/if}
              </div>
            {/if}
          </article>
        {/each}
      </div>
    </div>
  </section>
{/if}
