<script lang="ts">
import type { EventData, EventDTO } from '@lib/types';
import CalendarModal from './CalendarModal.svelte';
import EventMap from './EventMap.svelte';
import NewsletterForm from './NewsletterForm.svelte';
import RegistrationForm from './RegistrationForm.svelte';

interface Props {
  /** Event rendered at build time (null = no upcoming event scheduled). */
  event: EventDTO | null;
  /** WhatsApp community link, passed from Astro site data. */
  whatsappLink?: string;
}

const { event: initialEvent, whatsappLink }: Props = $props();

// The page is server-rendered per request, so the event content AND its
// volatile capacity (available spots / full / waitlist) are already live at
// first paint — no client-side refresh needed.
const event = initialEvent;

// ─── Date formatting (de-DE, Europe/Berlin) ────────────────────────
const TZ = 'Europe/Berlin';

function eventDate(iso: string): Date {
  return new Date(iso);
}

function weekday(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    timeZone: TZ,
  }).format(eventDate(iso));
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  }).format(eventDate(iso));
}

function longDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(eventDate(iso));
}

/** Build the EventData shape consumed by the calendar util. */
function calendarData(e: EventDTO): EventData {
  const dateOnly = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ,
  }).format(eventDate(e.event_date)); // YYYY-MM-DD

  return {
    title: e.title,
    description: e.description,
    location: e.location,
    startDate: dateOnly,
    startTime: e.start_time,
    endDate: dateOnly,
    endTime: e.end_time,
  };
}

function nl2brHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\r\n|\r|\n/g, '<br />');
}
</script>

{#if event}
  {@const e = event}
  <!-- Event Hero -->
  <section class="hero event-hero">
    <div class="hero__bg">
      {#if e.image_url}
        <img
          class="hero__bg-image"
          src={e.image_url}
          loading="eager"
          aria-hidden="true"
          alt={e.title}
        />
      {/if}
    </div>
    <div class="hero__circles" aria-hidden="true">
      <div class="hero__circle hero__circle--1"></div>
      <div class="hero__circle hero__circle--2"></div>
      <div class="hero__circle hero__circle--3"></div>
      <div class="hero__circle hero__circle--4"></div>
    </div>

    <div class="container">
      <div class="hero__content">
        <p class="hero__label">
          {e.is_past ? 'Vergangenes Treffen' : 'Nächstes Treffen'}
        </p>
        <h1 class="hero__title">
          <span class="hero__title-line">{e.title}</span>
        </h1>
        <div class="hero__bottom">
          <p class="hero__description">
            {weekday(e.event_date)}, {shortDate(e.event_date)} · {e.start_time} Uhr
            · {e.location}
          </p>
          {#if !e.is_past}
            <div class="hero__cta">
              <a href="#anmeldung" class="btn btn--primary btn--large"
                >Jetzt anmelden</a
              >
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  {#if e.is_past}
    <!-- Past Event Info Section -->
    <section class="event-register-section" id="anmeldung">
      <div class="event-register__layout">
        <div class="event-register__content">
          <div class="event-register__circles" aria-hidden="true">
            <div class="event-register__circle event-register__circle--1"></div>
            <div class="event-register__circle event-register__circle--2"></div>
          </div>
          <p class="eyebrow eyebrow--secondary">Rückblick</p>
          <h2
            class="section-title section-title--lg section-title--light event-register__title"
          >
            Dieses Treffen <br /><span class="text-italic"
              >hat stattgefunden</span
            >
          </h2>
          <p class="event-register__spots">
            <span>Am {shortDate(e.event_date)}</span>
          </p>
        </div>

        <div class="event-register__form-wrap">
          <div class="event-register__past-info">
            <p class="event-register__past-text">
              Dieses Treffen liegt in der Vergangenheit. Eine Anmeldung ist
              nicht mehr möglich.
            </p>
            <p class="event-register__past-text">
              Möchtest du beim nächsten Männerkreis dabei sein? Dann trag dich
              in unseren Newsletter ein, um über kommende Termine informiert zu
              werden.
            </p>
            <a href="/#newsletter" class="btn btn--primary btn--large"
              >Zum Newsletter anmelden</a
            >
          </div>
        </div>
      </div>
    </section>
  {:else}
    <!-- Registration Section -->
    <section class="event-register-section" id="anmeldung">
      <div class="event-register__layout">
        <div class="event-register__content">
          <div class="event-register__circles" aria-hidden="true">
            <div class="event-register__circle event-register__circle--1"></div>
            <div class="event-register__circle event-register__circle--2"></div>
          </div>
          {#if e.is_full}
            <p class="eyebrow eyebrow--secondary">Warteliste</p>
            <h2
              class="section-title section-title--lg section-title--light event-register__title"
            >
              Trag dich auf die <br /><span class="text-italic"
                >Warteliste ein</span
              >
            </h2>
            <p class="event-register__spots">
              <span class="event-register__spots-full">Ausgebucht</span>
            </p>
            <p class="event-register__spots-hint">
              Bei Absagen rückt die Warteliste automatisch nach. Du wirst sofort
              per E-Mail informiert.
            </p>
          {:else}
            <p class="eyebrow eyebrow--secondary">Sei dabei</p>
            <h2
              class="section-title section-title--lg section-title--light event-register__title"
            >
              Sichere dir <br /><span class="text-italic">deinen Platz</span>
            </h2>
            <p class="event-register__spots">
              <span class="event-register__spots-available"
                >{e.available_spots}</span
              >
              <span>von {e.max_participants} Plätzen frei</span>
            </p>
          {/if}
        </div>

        <div class="event-register__form-wrap">
          <RegistrationForm event={e} />
        </div>
      </div>
    </section>
  {/if}

  <!-- Event Info Section -->
  <section class="event-info-section">
    <div class="event-info__bg-text" aria-hidden="true">TERMIN</div>
    <div class="container">
      <div class="event-info__grid">
        <div class="event-info__card event-info__card--date">
          <div class="event-info__card-circle" aria-hidden="true"></div>
          <div class="event-info__card-content">
            <h3>Datum</h3>
            <p class="event-info__card-value">{weekday(e.event_date)}</p>
            <p class="event-info__card-sub">{longDate(e.event_date)}</p>
          </div>
        </div>

        <div class="event-info__card event-info__card--time">
          <div class="event-info__card-circle" aria-hidden="true"></div>
          <div class="event-info__card-content">
            <h3>Uhrzeit</h3>
            <p class="event-info__card-value">{e.start_time} Uhr</p>
            <p class="event-info__card-sub">bis {e.end_time} Uhr</p>
          </div>
        </div>

        <div class="event-info__card event-info__card--location">
          <div class="event-info__card-circle" aria-hidden="true"></div>
          <div class="event-info__card-content">
            <h3>Ort</h3>
            <p class="event-info__card-value">{e.location}</p>
            <p class="event-info__card-sub">Genaue Adresse nach Anmeldung</p>
          </div>
        </div>

        <div class="event-info__card event-info__card--participants">
          <div class="event-info__card-circle" aria-hidden="true"></div>
          <div class="event-info__card-content">
            <h3>Teilnehmer</h3>
            <p class="event-info__card-value">Max. {e.max_participants}</p>
            <p class="event-info__card-sub">{e.cost_basis}</p>
          </div>
        </div>
      </div>

      <CalendarModal event={calendarData(e)} />
    </div>
  </section>

  {#if e.latitude !== null && e.longitude !== null}
    <!-- Event Location Map -->
    <section class="event-map-section">
      <div class="container">
        <div class="event-map__header">
          <p class="eyebrow">Anfahrt</p>
          <h2 class="section-title section-title--lg event-map__title">
            So findest du <span class="text-italic">zu uns</span>
          </h2>
          <p class="event-map__subtitle">
            {[e.street, [e.postal_code, e.city].filter(Boolean).join(' ')]
              .filter(Boolean)
              .join(', ') || e.location}
          </p>
        </div>

        <EventMap
          lat={e.latitude}
          lng={e.longitude}
          title={e.location}
          address={[e.street, [e.postal_code, e.city].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(', ') || e.location}
        />

        <div class="event-map__actions">
          <a
            href={`https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}#map=17/${e.latitude}/${e.longitude}`}
            target="_blank"
            rel="noopener"
            class="btn btn--secondary"
          >
            In OpenStreetMap öffnen
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}`}
            target="_blank"
            rel="noopener"
            class="btn btn--primary"
          >
            Route mit Google Maps
          </a>
        </div>

        <p class="event-map__attribution">
          Karte von
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener">OpenStreetMap</a
          >-Mitwirkenden
        </p>
      </div>
    </section>
  {/if}

  <!-- Event Description Section -->
  <section class="event-about-section">
    <div class="event-about__layout">
      <div class="event-about__content">
        <p class="eyebrow">Über das Treffen</p>
        <h2 class="section-title section-title--lg event-about__title">
          Ein Raum für <br /><span class="text-italic">echte Begegnung</span>
        </h2>
        <div class="event-about__text">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html nl2brHtml(e.description)}
        </div>
      </div>
      <div class="event-about__visual">
        <div class="event-about__quote-area">
          <div class="event-about__circles" aria-hidden="true">
            <div class="event-about__circle event-about__circle--1"></div>
            <div class="event-about__circle event-about__circle--2"></div>
            <div class="event-about__circle event-about__circle--3"></div>
          </div>
          <p class="event-about__quote">
            »Gemeinsam<br />
            <span class="text-italic">wachsen</span>,<br />
            einander<br />
            <span class="text-italic">stärken</span>«
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Final CTA Section -->
  <section class="event-cta-section">
    <div class="event-cta__circles" aria-hidden="true">
      <div class="event-cta__circle event-cta__circle--1"></div>
      <div class="event-cta__circle event-cta__circle--2"></div>
    </div>
    <div class="container">
      <div class="event-cta__content">
        {#if e.is_past}
          <p class="eyebrow">Interesse geweckt?</p>
          <h2 class="section-title event-cta__title">
            Bleib <span class="text-italic">informiert</span>
          </h2>
          <a href="/#newsletter" class="btn btn--primary btn--large"
            >Newsletter abonnieren</a
          >
        {:else}
          <p class="eyebrow">Bereit?</p>
          <h2 class="section-title event-cta__title">
            Melde dich <span class="text-italic">jetzt</span> an
          </h2>
          <a href="#anmeldung" class="btn btn--primary btn--large"
            >Zur Anmeldung</a
          >
        {/if}
      </div>
    </div>
  </section>
{:else}
  <!-- No event -->
  <section class="hero no-event-hero">
    <div class="hero__circles" aria-hidden="true">
      <div class="hero__circle hero__circle--1"></div>
      <div class="hero__circle hero__circle--2"></div>
      <div class="hero__circle hero__circle--3"></div>
      <div class="hero__circle hero__circle--4"></div>
    </div>

    <div class="container">
      <div class="hero__content">
        <p class="hero__label">Männerkreis Niederbayern/ Straubing</p>
        <h1 class="hero__title">
          <span class="hero__title-line">Aktuell ist kein</span>
          <span class="hero__title-line"
            ><span class="text-italic">Termin</span> geplant</span
          >
        </h1>
        <div class="hero__bottom">
          <p class="hero__description">
            Wir planen gerade unser nächstes Treffen. Melde dich für unseren
            Newsletter an oder tritt unserer WhatsApp-Community bei, um als
            Erster zu erfahren, wann es weitergeht.
          </p>
          <div class="hero__cta">
            <a href="#newsletter" class="btn btn--primary btn--large"
              >Zum Newsletter</a
            >
            <div class="hero__scroll">
              <span>Mehr erfahren</span>
              <div class="hero__scroll-line"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Info Section -->
  <section class="section no-event-info-section">
    <div class="container">
      <div class="no-event-info__layout">
        <div class="no-event-info__content">
          <p class="eyebrow">Was ist der Männerkreis?</p>
          <h2 class="section-title no-event-info__title">
            Ein Raum für <span class="text-italic">echte Begegnung</span>
          </h2>
          <p class="no-event-info__text">
            Der Männerkreis Niederbayern/ Straubing bietet dir einen geschützten
            Raum, in dem du dich mit anderen Männern austauschen, wachsen und
            echte Verbindungen aufbauen kannst. Unsere Treffen finden regelmäßig
            statt – sobald der nächste Termin feststeht, informieren wir dich.
          </p>
        </div>
        <div class="no-event-info__visual">
          <div class="no-event-info__quote-area">
            <div class="event-about__circles" aria-hidden="true">
              <div class="event-about__circle event-about__circle--1"></div>
              <div class="event-about__circle event-about__circle--2"></div>
              <div class="event-about__circle event-about__circle--3"></div>
            </div>
            <p class="event-about__quote">
              »Bleib<br />
              <span class="text-italic">verbunden</span>«
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Newsletter Section -->
  <section class="section newsletter-section" id="newsletter">
    <div class="container">
      <div class="newsletter__layout">
        <div class="newsletter__content">
          <p class="eyebrow eyebrow--secondary">Newsletter</p>
          <h2 class="section-title newsletter__title">
            Bleib <span class="text-italic">informiert</span>
          </h2>
          <p class="newsletter__text">
            Erhalte als Erster Bescheid, wenn unser nächstes Treffen
            stattfindet. Kein Spam, nur relevante Informationen zum Männerkreis.
          </p>
        </div>

        <div class="newsletter__form-wrapper">
          <NewsletterForm context={{ page: 'no-event' }} />
        </div>
      </div>
    </div>
  </section>

  {#if whatsappLink}
    <!-- WhatsApp Community Section -->
    <section class="section whatsapp-section" id="whatsapp-community">
      <div class="container">
        <div class="whatsapp__layout">
          <div class="whatsapp__content">
            <p class="eyebrow whatsapp__eyebrow">Community</p>
            <h2 class="section-title whatsapp__title">
              Tritt unserer <span class="text-italic">WhatsApp Community</span> bei
            </h2>
            <p class="whatsapp__text">
              Bleibe mit anderen Männern in Verbindung, erhalte Erinnerungen zu
              unseren Treffen und tausche dich zwischen den Kreisen aus. Ein
              Raum für Austausch und gegenseitige Unterstützung.
            </p>
          </div>

          <div class="whatsapp__action">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn--whatsapp whatsapp__button"
            >
              <span>Community beitreten</span>
            </a>
            <p class="whatsapp__hint">Kostenlos und unverbindlich</p>
          </div>
        </div>
      </div>
    </section>
  {/if}

  <!-- Back to Home CTA -->
  <section class="section no-event-cta-section">
    <div class="container">
      <div class="no-event-cta__content">
        <p class="eyebrow">Mehr erfahren</p>
        <h2 class="section-title no-event-cta__title">
          Entdecke den <span class="text-italic">Männerkreis</span>
        </h2>
        <p class="no-event-cta__text">
          Erfahre mehr über uns, unsere Werte und was dich bei einem Treffen
          erwartet.
        </p>
        <a href="/" class="btn btn--primary btn--large">Zur Startseite</a>
      </div>
    </div>
  </section>
{/if}
