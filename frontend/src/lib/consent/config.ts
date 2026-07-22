// Injected at build time from VITE_GOOGLE_ANALYTICS_ID (see .env.example);
// falls back to a placeholder so dev/test runs without a real ID never ship
// live tracking.
export const GOOGLE_ANALYTICS_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_ID || "G-XXXXXXXXXX";

// Injected at build time from VITE_FACEBOOK_PIXEL_ID (see .env.example).
export const FACEBOOK_PIXEL_ID = import.meta.env.VITE_FACEBOOK_PIXEL_ID || "0000000000000000";

export const CONSENT_STORAGE_KEY = "cookie-consent";
