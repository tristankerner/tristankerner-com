// Renders a ResumeContent value as the source of
// src/routes/about-me/resume-data.generated.ts.
//
// Split out from sync-resume.ts so it can be tested without a network call,
// and so the initial bootstrap of the generated file could use it before the
// file it generates existed.
//
// Only the *data* is generated. The types, the date-formatting helpers, and
// the assembly into `defaultContent` stay hand-written in content.ts, which is
// the whole reason for the split: content.ts carries a lot of curated
// commentary about why fields are shaped the way they are, and a generator
// that rewrote it wholesale would erase that on every sync.

import type { ResumeContent } from "../src/routes/about-me/content";

/** Where this file's output belongs, relative to `frontend/`. */
export const GENERATED_PATH = "src/routes/about-me/resume-data.generated.ts";

/**
 * The exported name of each section, paired with the type annotation it gets.
 * Ordered as they appear in the file; `ResumeContent`'s own key order is not
 * load-bearing, but a stable order here keeps the diff between two syncs down
 * to what actually changed.
 */
const SECTIONS: [keyof ResumeContent, string][] = [
  ["profile", "Profile"],
  ["contact", "Contact"],
  ["summary", "string"],
  ["skillGroups", "SkillGroup[]"],
  ["certifications", "Certification[]"],
  ["jobs", "Job[]"],
  ["education", "Education[]"],
  ["personalProjects", "PersonalProject[]"],
];

const HEADER = `// GENERATED FILE - do not edit by hand.
//
// Written by \`bun run sync-resume\` (frontend/scripts/sync-resume.ts) from the
// resume microservice's public feed, and regenerated in CI before every
// production build. To change any of this, edit the resume in that service and
// re-run the command - edits made here are lost on the next sync.
//
// This is the copy of the resume compiled into the build: what the prerendered
// about-me page contains (so it is what search engines index and what a
// visitor without JavaScript reads), and what the page falls back to when the
// feed is unreachable. See ./content.ts for the types and the helpers that
// derive display prose from these values, and ./remote.ts for the runtime
// fetch that supersedes them in the browser.
`;

/**
 * JSON is a subset of TypeScript's object-literal syntax for this data - every
 * key is a valid identifier and every value is a string, array, object, or
 * null - so stringify produces valid source directly. Two details make it the
 * right tool rather than a lucky one:
 *
 * - `undefined` values are dropped entirely, which is exactly the wanted
 *   result: content.ts spells an absent optional as a missing key, and
 *   `{ id: undefined }` would be noise.
 * - `null` is preserved, which matters because a null `end` is a real value
 *   meaning "still current", not an absent one.
 *
 * The quoted keys stringify emits are unquoted by `oxfmt`, which sync-resume.ts
 * runs over the file afterwards so it satisfies `bun run fmt:check` like
 * anything else in the repo.
 */
export function renderResumeData(content: ResumeContent): string {
  const types = SECTIONS.map(([, type]) => type.replace("[]", ""))
    .filter((type) => type !== "string")
    .sort();

  const body = SECTIONS.map(
    ([key, type]) => `export const ${key}: ${type} = ${JSON.stringify(content[key], null, 2)};`,
  ).join("\n\n");

  return `${HEADER}
import type { ${types.join(", ")} } from "./content";

${body}
`;
}
