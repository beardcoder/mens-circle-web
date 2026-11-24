/** Every Astro Action, served at `/_actions/*` and called as `actions.<name>()`. */
import { forms } from './forms';

export const server = { ...forms };
