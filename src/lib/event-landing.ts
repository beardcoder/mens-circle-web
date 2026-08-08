/**
 * Content for the /event landing page.
 *
 * This lives outside the components on purpose: the page renders these strings
 * AND emits some of them as JSON-LD (FAQPage). Google treats FAQ markup that
 * doesn't match the visible text as a structured-data violation, so both have to
 * read from one source — hence a module rather than copy in two places.
 *
 * Editorial brief: the home page answers "what is a Männerkreis and what does it
 * stand for". This page answers "what is it actually like to walk in there, and
 * do I dare try it once". So the copy here stays deliberately plain — no
 * Wachstum/Transformation/Spiegelung vocabulary, no manufactured scarcity — and
 * every factual claim traces back to content already in the repo:
 * src/content/home.json (Straubing, alle zwei bis vier Wochen, 2–3 Stunden,
 * Spendenbasis, Vertraulichkeit, keine Vorerfahrung, weder Therapie noch
 * Coaching) and src/content/warum-ich-den-maennerkreis-leite.json (einfache
 * Übungen mit Atem und Körperwahrnehmung, jeder bleibt für sich verantwortlich,
 * niemand wird gedrängt). Nothing here is invented.
 *
 * Server-render only. It imports the date formatters from lib/server/format,
 * which is safe — that module's only server import is a `type`, so nothing pulls
 * `bun:sqlite` — but this module still has no business in a client bundle.
 */
import type { EventDTO } from './types';
import { formatDayMonthYearDE, formatWeekdayDE } from './server/format';
import site from '../data/site.json';

export interface FaqEntry {
  question: string;
  answer: string;
}

/** The upcoming event reduced to the strings the landing page actually shows. */
export interface NextEventSummary {
  slug: string;
  /** "Donnerstag, 18. September 2026" */
  dateLabel: string;
  /** "19:00–21:30 Uhr", or empty when no time is set. */
  timeRange: string;
  /** City, falling back to the venue name and then the site's own locality. */
  place: string;
  /** Free-text participation fee for this evening, empty when not set. */
  costBasis: string;
  isFull: boolean;
  availableSpots: number;
  maxParticipants: number;
}

export const summarizeNextEvent = (event: EventDTO | null): NextEventSummary | null => {
  if (!event) return null;

  const weekday = formatWeekdayDE(event.event_date);
  const dayMonthYear = formatDayMonthYearDE(event.event_date);

  return {
    slug: event.slug,
    dateLabel: [weekday, dayMonthYear].filter(Boolean).join(', '),
    timeRange: event.start_time ? `${event.start_time}${event.end_time ? `–${event.end_time}` : ''} Uhr` : '',
    place: event.city || event.location || site.geo.locality,
    costBasis: event.cost_basis?.trim() ?? '',
    isFull: event.is_full,
    availableSpots: event.available_spots,
    maxParticipants: event.max_participants,
  };
};

/**
 * "Vielleicht kennst du das" — the questions the evening actually circles
 * around, phrased the way a man would ask them himself.
 */
export const EVENT_EVERYDAY_QUESTIONS = [
  'Was beschäftigt dich gerade wirklich?',
  'Was läuft gerade gut?',
  'Was kostet dich Kraft?',
  'Was schiebst du vielleicht schon länger vor dir her?',
] as const;

/**
 * The evening from a first-timer's point of view.
 *
 * Deliberately *not* the home page's "Die Reise" arc (Ankommen → Öffnen →
 * Wachsen → Integrieren). Same evening, different question: that block explains
 * the rhythm of the circle, this one describes what you will find yourself
 * doing — listening, and speaking only as much as you want to.
 */
export const EVENT_RHYTHM = [
  {
    step: '01',
    title: 'Ankommen',
    text: 'Erst einmal raus aus dem Alltag. Wir nehmen uns Zeit anzukommen und kurz wahrzunehmen, wie jeder gerade da ist. Je nach Abend gehört dazu eine einfache Übung mit Atem oder Körperwahrnehmung.',
  },
  {
    step: '02',
    title: 'Zuhören',
    text: 'Einer spricht, die anderen hören zu. Nicht, um sofort eine Lösung zu finden. Nicht, um zu diskutieren. Sondern erst einmal, um wirklich zu verstehen.',
  },
  {
    step: '03',
    title: 'Teilen',
    text: 'Wenn du möchtest, erzählst du, was dich gerade beschäftigt. Wie persönlich das wird, entscheidest du selbst. Niemand wird gedrängt.',
  },
  {
    step: '04',
    title: 'Mitnehmen',
    text: 'Am Ende musst du nicht mit einer großen Erkenntnis nach Hause gehen. Manchmal reicht ein Gedanke, eine andere Perspektive oder die Erfahrung, mit etwas nicht allein zu sein.',
  },
] as const;

/** "Zum ersten Mal dabei?" — what you explicitly do *not* need to bring. */
export const EVENT_NO_PREP = [
  'keine Erfahrung mit Männerkreisen',
  'keine Meditationserfahrung',
  'keine Erfahrung mit Atemarbeit',
  'kein bestimmtes Weltbild',
  'keine Vorbereitung',
] as const;

/** "Vielleicht ist der Kreis etwas für dich, wenn …" — reasons, not benefits. */
export const EVENT_FIT = [
  'du dir ehrlichere Gespräche mit anderen Männern wünschst',
  'du gerade vor Veränderungen oder Entscheidungen stehst',
  'du viel Verantwortung trägst',
  'du oft im Kopf bist und schwer abschalten kannst',
  'dir der Austausch mit anderen Männern fehlt',
  'du dich selbst etwas besser verstehen möchtest',
  'du einfach neugierig bist',
] as const;

/** Clear boundaries. Demarcation, never a swipe at therapy or coaching. */
export const EVENT_NOT_THIS = [
  'keine Therapie',
  'kein Coachingprogramm',
  'kein religiöses Treffen',
  'keine Selbstoptimierungsgruppe',
  'kein Ort, an dem dir jemand erklärt, wie ein Mann zu sein hat',
] as const;

/** The four ground rules, spelled out rather than summarised as "Regeln". */
export const EVENT_FRAME = [
  {
    title: 'Vertraulichkeit',
    text: 'Was im Kreis erzählt wird, bleibt im Kreis. Das gilt für alle gleichermaßen und wird zu Beginn jedes Abends benannt.',
  },
  {
    title: 'Respekt',
    text: 'Wir hören einander zu, auch wenn Erfahrungen und Sichtweisen unterschiedlich sind.',
  },
  {
    title: 'Eigenverantwortung',
    text: 'Du entscheidest selbst, was du erzählst und woran du teilnehmen möchtest. Jeder bleibt für sich selbst verantwortlich.',
  },
  {
    title: 'Keine ungefragten Lösungen',
    text: 'Wir versuchen nicht, den anderen Mann zu reparieren. Oft ist Zuhören hilfreicher als der nächste Ratschlag.',
  },
] as const;

export interface EventFact {
  label: string;
  value: string;
  sub: string;
}

/**
 * The quick-scan facts. General by nature, but a scheduled evening overrides
 * what it actually knows: its city, its time window, its participation fee. The
 * venue is never hardcoded beyond the city — the exact address only goes out
 * with the registration confirmation.
 */
export const buildEventFacts = (next: NextEventSummary | null): EventFact[] => [
  {
    label: 'Wo',
    value: next?.place || site.geo.locality,
    sub: 'Die genaue Adresse bekommst du mit der Anmeldung',
  },
  {
    label: 'Wie oft',
    value: 'Alle 2–4 Wochen',
    sub: 'Ein fester Rhythmus, keine Mitgliedschaft',
  },
  {
    label: 'Dauer',
    value: '2–3 Stunden',
    sub: next?.timeRange ? `Nächster Termin: ${next.timeRange}` : 'Ein Abend, kein Wochenendseminar',
  },
  {
    // The evening's own fee text wins when the admin set one — it may name a
    // suggested amount that the generic "Spendenbasis" would swallow.
    label: 'Beitrag',
    value: next?.costBasis || 'Spendenbasis',
    sub: 'Jeder gibt, was für ihn machbar ist',
  },
];

/**
 * The questions a man has right before his first evening — deliberately distinct
 * from the home page's FAQ set, which answers "what is a Männerkreis at all".
 * Two FAQPage blocks asking the same questions on two URLs would only compete.
 *
 * The first answer is the only one that depends on live data, which is exactly
 * why this is a function.
 */
export const buildEventFaq = (next: NextEventSummary | null): FaqEntry[] => [
  {
    question: 'Wann findet der nächste Männerkreis statt?',
    answer: next
      ? `Der nächste Termin ist ${next.dateLabel}${next.timeRange ? ` um ${next.timeRange}` : ''} in ${next.place}. Alle Details und die Anmeldung findest du auf der Terminseite.`
      : 'Der nächste Termin steht noch nicht fest. Sobald er geplant ist, erfährst du es über den Newsletter oder die WhatsApp-Community – beide findest du auf dieser Seite.',
  },
  {
    question: 'Muss ich etwas erzählen?',
    answer:
      'Nein. Du entscheidest selbst, was du teilen möchtest. Es gibt keinen Zwang, persönliche Dinge zu erzählen, und niemand wird gedrängt. Zuhören ist genauso Teil des Kreises wie sprechen.',
  },
  {
    question: 'Kann ich alleine kommen?',
    answer:
      'Ja. Du musst vorher niemanden kennen. Es reicht, wenn du dich für einen Termin anmeldest und an dem Abend da bist.',
  },
  {
    question: 'Ich war noch nie bei einem Männerkreis. Ist das ein Problem?',
    answer:
      'Nein. Du brauchst keinerlei Vorerfahrung und musst nichts vorbereiten. Der Rahmen wird zu Beginn erklärt, damit du weißt, worauf du dich einlässt.',
  },
  {
    question: 'Gibt es Atemübungen oder Meditation?',
    answer:
      'Je nach Abend kann eine einfache Übung mit Atem, Körperwahrnehmung oder Stille dazugehören. Sie wird vorher erklärt, bleibt bodenständig und du entscheidest selbst, woran du teilnimmst.',
  },
  {
    question: 'Ist der Männerkreis Therapie oder Coaching?',
    answer:
      'Nein. Der Männerkreis ist weder Therapie noch Coaching. Wir sitzen als Männer zusammen, hören einander zu und teilen Erfahrungen. Wenn du therapeutische Unterstützung brauchst, ist professionelle Hilfe der richtige Weg.',
  },
  {
    question: 'Was kostet die Teilnahme?',
    answer: next?.costBasis
      ? `Für den nächsten Termin gilt: ${next.costBasis}. Du gibst, was dir der Abend wert ist und was für dich machbar ist – einen festen Preis oder eine Mitgliedschaft gibt es nicht.`
      : 'Der Kreis läuft auf Spendenbasis. Du gibst, was dir der Abend wert ist und was für dich machbar ist. Es gibt keinen festen Preis und keine Mitgliedschaft.',
  },
  {
    question: 'Wo findet der Männerkreis statt?',
    answer: `Der Männerkreis findet in ${next?.place || site.geo.locality} in Niederbayern statt. Die genaue Adresse bekommst du mit der Anmeldebestätigung – so bleibt der Ort der Gruppe vorbehalten, die tatsächlich zusammenkommt.`,
  },
  {
    question: 'Wie melde ich mich an?',
    answer:
      'Über das Anmeldeformular auf der jeweiligen Terminseite. Du brauchst nur Vor- und Nachnamen und eine E-Mail-Adresse. Danach bekommst du eine Bestätigung per E-Mail mit dem genauen Treffpunkt. Ist ein Abend ausgebucht, kommst du auf die Warteliste und rückst nach, sobald ein Platz frei wird.',
  },
];
