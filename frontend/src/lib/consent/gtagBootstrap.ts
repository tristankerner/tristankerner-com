import { GOOGLE_ANALYTICS_ID } from "./config.ts";

export const GTAG_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;

// Runs unconditionally on every page load, ahead of hydration - embedded as
// an inline <script> in the root layout's <svelte:head> (see +layout.svelte),
// which prerendering bakes directly into the static HTML <head>. Denies
// every consent type by default so gtag.js can still send cookieless/modeled
// pings before the banner is answered, per the ordering rules in
// https://developers.google.com/tag-platform/security/guides/consent
// ("default" must run before any config/event command, and as early as
// possible relative to the tag itself). The real `consent`/`update` call,
// seeded from any stored choice, happens once the app hydrates - see
// analytics.ts's applyConsent. `wait_for_update` gives that hydration a
// short grace window before gtag.js proceeds on the denied default.
export const GTAG_BOOTSTRAP_SCRIPT = `
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
gtag('js', new Date());
gtag('config', '${GOOGLE_ANALYTICS_ID}');
`.trim();
