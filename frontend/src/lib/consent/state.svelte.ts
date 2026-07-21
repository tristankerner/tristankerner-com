export interface ConsentCategories {
  analytics: boolean;
  marketing: boolean;
}

export type ConsentStatus = "pending" | "decided";

export const consentState = $state({
  status: "pending" as ConsentStatus,
  // Defaulted to true so the "Accept All" path in the banner and the
  // preferences modal start from the same (opted-in) toggle positions.
  categories: { analytics: true, marketing: true } as ConsentCategories,
});
