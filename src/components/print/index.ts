/** Each template's component by id (lib/brand/registry.ts). */
import type { TemplateId } from '@lib/brand/registry';

import Card from './Card.astro';
import FlyerA6 from './FlyerA6.astro';
import FlyerDl from './FlyerDl.astro';
import LogoLockup from './LogoLockup.astro';
import OgDefault from './OgDefault.astro';
import OgMarkus from './OgMarkus.astro';
import PosterA3 from './PosterA3.astro';
import Social from './Social.astro';

export const TEMPLATE_COMPONENTS: Record<TemplateId, typeof Card> = {
  'flyer-a6': FlyerA6,
  'flyer-dl': FlyerDl,
  'poster-a3': PosterA3,
  card: Card,
  'ig-square': Social,
  'ig-portrait': Social,
  'ig-story': Social,
  'og-default': OgDefault,
  'og-markus': OgMarkus,
  'logo-lockup': LogoLockup,
};
