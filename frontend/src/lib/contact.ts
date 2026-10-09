/**
 * A disposable contact address, deliberately kept out of the resume feed:
 * that feed is public and unauthenticated, and a machine-readable address at
 * a predictable URL is a scraping target (see the `Contact` type in
 * ../routes/about-me/content.ts). It ships in the client bundle instead,
 * which is an accepted cost since it's already surfaced directly in the UI
 * (header, footer, about-me page) and in the generated resume download.
 * Replace it here when it burns out.
 */
export const CONTACT_EMAIL = "tk.pub.resume.passerby769@passinbox.com";
