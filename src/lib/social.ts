/** Social link type → sprite icon name + German label. Mirrors the original
 *  SocialLinkType enum. */
export type SocialType =
  | 'email'
  | 'phone'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'youtube'
  | 'whatsapp'
  | 'telegram'
  | 'website'
  | 'other';

const MAP: Record<SocialType, { icon: string; label: string }> = {
  email: { icon: 'social-email', label: 'E-Mail' },
  phone: { icon: 'social-phone', label: 'Telefon' },
  instagram: { icon: 'social-instagram', label: 'Instagram' },
  facebook: { icon: 'social-facebook', label: 'Facebook' },
  twitter: { icon: 'social-twitter', label: 'Twitter (X)' },
  linkedin: { icon: 'social-linkedin', label: 'LinkedIn' },
  youtube: { icon: 'social-youtube', label: 'YouTube' },
  whatsapp: { icon: 'social-whatsapp', label: 'WhatsApp' },
  telegram: { icon: 'social-telegram', label: 'Telegram' },
  website: { icon: 'social-website', label: 'Website' },
  other: { icon: 'social-other', label: 'Sonstiges' },
};

export interface SocialLink {
  type: string;
  value: string;
  label?: string;
}

export interface ResolvedSocialLink {
  href: string;
  title: string;
  iconName: string;
  type: SocialType;
  internal: boolean;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string): boolean {
  return /^\+?[0-9\s\-()]+$/.test(value);
}

export function resolveSocialLink(link: SocialLink): ResolvedSocialLink {
  const type = (
    Object.keys(MAP).includes(link.type) ? link.type : 'other'
  ) as SocialType;
  const meta = MAP[type];
  const title = link.label || meta.label;

  let href = link.value;
  let internal =
    href.startsWith('mailto:') || href.startsWith('tel:');

  if (!internal) {
    if (isEmail(href)) {
      href = `mailto:${href}`;
      internal = true;
    } else if (isPhone(href)) {
      href = `tel:${href.replace(/[\s\-()]/g, '')}`;
      internal = true;
    }
  }

  return { href, title, iconName: meta.icon, type, internal };
}
