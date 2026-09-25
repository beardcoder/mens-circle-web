/** Written next to entry.mjs at build time, read once at startup. */
export const MANIFEST_FILE = 'static-headers.json';

/** Header overrides per static file, keyed by its path below the client directory (`/impressum/index.html`). */
export type StaticHeaders = Record<string, Record<string, string>>;

/** What the build hands the server through the virtual config module. */
export interface RuntimeConfig {
  host: string;
  port: number;
  /** The client directory, relative to the server directory. */
  clientDir: string;
  /** `build.assets`: files below it are content-hashed and cached for a year. */
  assets: string;
  staticCacheControl: string;
  compress: boolean;
}
