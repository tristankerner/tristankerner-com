// Injected at build time from VITE_GOOGLE_ANALYTICS_ID (see .env.example);
// falls back to a placeholder so dev/test runs without a real ID never ship
// live tracking.
export const GOOGLE_ANALYTICS_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_ID || "G-XXXXXXXXXX";

// Injected at build time from VITE_FACEBOOK_PIXEL_ID (see .env.example).
// Unlike GOOGLE_ANALYTICS_ID, this has no placeholder fallback: an unset or
// blank value means the pixel isn't configured yet, and analytics.ts skips
// loading it entirely rather than handing fbevents.js an ID it'll reject.
export const FACEBOOK_PIXEL_ID = import.meta.env.VITE_FACEBOOK_PIXEL_ID?.trim() || undefined;

export const CONSENT_STORAGE_KEY = "cookie-consent";
