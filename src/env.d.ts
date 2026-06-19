/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Authenticated admin email, set by the middleware on admin routes. */
    admin?: string;
  }
}
