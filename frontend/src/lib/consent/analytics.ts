import type { ConsentCategories } from "./state.svelte.ts";
import { FACEBOOK_PIXEL_ID } from "./config.ts";

type FbqFn = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

// ID used to detect whether the pixel script is already in the document, so
// calling applyConsent() more than once (e.g. after changing preferences)
// never injects it twice.
const PIXEL_SCRIPT_ID = "consent-fb-pixel-script";

// The Google tag itself is always loaded, with a denied-by-default consent
// state set before it ever runs - see gtagBootstrap.ts, wired into the root
// layout's <svelte:head>. This just reports the visitor's actual choice to
// it, per https://developers.google.com/tag-platform/security/guides/consent.
// `ad_storage`/`ad_user_data`/`ad_personalization` stay permanently denied -
// this site has no Google Ads/Floodlight tag reading them; only
// `analytics_storage` reflects the "analytics" toggle.
function updateGoogleConsent(analyticsGranted: boolean) {
  window.gtag?.("consent", "update", {
    analytics_storage: analyticsGranted ? "granted" : "denied",
  });
}

// Standard Meta Pixel bootstrap snippet, adapted for TypeScript. No-ops when
// FACEBOOK_PIXEL_ID isn't configured (unset or blank) - there's nothing
// useful to load yet, and initializing fbevents.js with no real ID just logs
// an "Invalid PixelID" warning and tracks nothing.
function loadFacebookPixel() {
  if (!FACEBOOK_PIXEL_ID) return;
  if (document.getElementById(PIXEL_SCRIPT_ID)) return;

  const fbq: FbqFn = ((...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue.push(args);
    }
  }) as FbqFn;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.id = PIXEL_SCRIPT_ID;
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq("init", FACEBOOK_PIXEL_ID);
  window.fbq("track", "PageView");
}

export function applyConsent(categories: ConsentCategories) {
  updateGoogleConsent(categories.analytics);
  if (categories.marketing) loadFacebookPixel();
}

// SvelteKit's client-side router updates the URL via the History API instead
// of a full page load, so neither tracker's own auto-fired pageview (gtag's
// initial `config` call, fbq's initial `track PageView` call) ever sees
// subsequent in-app navigations. Call this after every client-side route
// change to report them explicitly; harmless no-op for whichever tracker
// hasn't been loaded (consent not granted, or not yet applied).
export function trackPageView(path: string) {
  window.gtag?.("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
  window.fbq?.("track", "PageView");
}
