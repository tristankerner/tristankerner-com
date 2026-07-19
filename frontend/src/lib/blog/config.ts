// Absolute origin used for canonical URLs, Open Graph/Twitter tags, and JSON-LD.
// Hardcoded (rather than derived from `url.origin`) so prerendered HTML always
// carries the real production origin regardless of the host the build ran on.
export const SITE_URL = "https://tristankerner.com";
export const SITE_NAME = "Tristan Kerner";

export const POSTS_PER_PAGE = 10;
