/** The files of the token export by name, from the theme's text. Pure, so the drift test can rebuild them. */
import { toAse, toCss, toDtcg, toGpl } from './formats';
import { parseTheme } from './theme-tokens';

export const brandFiles = (themeCss: string): Record<string, string | Uint8Array> => {
  const tokens = parseTheme(themeCss);

  return {
    'tokens.json': `${JSON.stringify(toDtcg(tokens), null, 2)}\n`,
    'tokens.css': toCss(tokens),
    'palette.gpl': toGpl(tokens),
    'palette.ase': toAse(tokens),
  };
};
