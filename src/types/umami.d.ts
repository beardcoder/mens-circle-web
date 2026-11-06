/** Umami's tracker, when analytics is configured (SeoHead.astro). */
interface Window {
  umami?: { track: (name: string, data?: Record<string, unknown>) => void };
}
