/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Authenticated admin email, set by the middleware on admin routes. */
    admin?: string;
  }
}

/** Built by `astro-integrations/hero-images.mjs` during `astro:config:setup`:
 *  the responsive variants of the images that on-demand pages show, resized at
 *  build time so the server never loads an image library. */
declare module 'virtual:hero-images' {
  export const heroImages: Record<
    string,
    {
      width: number;
      height: number;
      sources: { type: string; srcset: string }[];
      src: string;
      srcset: string;
    }
  >;
}
