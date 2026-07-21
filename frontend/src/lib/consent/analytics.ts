import type { ConsentCategories } from "./state.svelte.ts";
import { FACEBOOK_PIXEL_ID, GOOGLE_ANALYTICS_ID } from "./config.ts";

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

// IDs used to detect whether a script is already in the document, so calling
// applyConsent() more than once (e.g. after changing preferences) never
// injects either tracker twice.
const GA_SCRIPT_ID = "consent-ga-script";
const PIXEL_SCRIPT_ID = "consent-fb-pixel-script";

function loadGoogleAnalytics() {
  if (document.getElementById(GA_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  const gtag = (...args: unknown[]) => window.dataLayer!.push(args);
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GOOGLE_ANALYTICS_ID);
}

// Standard Meta Pixel bootstrap snippet, adapted for TypeScript.
function loadFacebookPixel() {
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
  if (categories.analytics) loadGoogleAnalytics();
  if (categories.marketing) loadFacebookPixel();
}
