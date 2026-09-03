/**
 * Reads the about-me page's content from the resume microservice, so a revision
 * published there is live here without a redeploy.
 *
 * Three things shape everything below.
 *
 * The feed is a *different service's* wire format: JSON Resume 1.0 - `basics`,
 * `work`, `education`, `certificates`, `skills`, `projects` - wrapped in a
 * revision envelope, camelCase throughout, sending `null` where these types use
 * an absent field. `normalize` deals with the envelope and the null-vs-absent
 * gap mechanically; the readers further down still have to reshape the feed's
 * official section names into this page's own vocabulary (`profile`, `contact`,
 * `jobs`, `personalProjects`, ...), which the feed and this page have never
 * agreed on and don't need to.
 *
 * The feed is untrusted input. Not because the service is suspect, but because
 * "JSON fetched over the network" is the definition of untrusted: this page
 * puts feed values into `href` attributes, which Svelte does not sanitize. See
 * `safeUrl`. Validation is not only for the browser either - `bun run
 * sync-resume` runs the same readers to decide what gets written into
 * resume-data.generated.ts and committed, so a malformed feed is caught before
 * it can be baked into a build.
 *
 * The page must survive the feed being wrong or gone. Failures resolve to
 * `null`, which the page reads as "keep the content compiled into the build" -
 * a resume a few revisions behind beats a blank page.
 *
 * That last one is why the line between "absent" and "malformed" matters more
 * than it looks. Rejecting is all-or-nothing: one unreadable field anywhere
 * costs every section, silently, and the visitor sees a resume that stopped
 * updating rather than an error. So a field is required here only when it is
 * one of the three the page keys on (`basics.name`, `work[].name`,
 * `highlights[].id`) or one the feed's own metadata document declares
 * `required: true` (`basics.summary`, `highlights[].summary`,
 * `skills[].keywords[].name`, `work[].roles[].title`). Everything else the
 * JSON Resume schema leaves optional is read as optional and rendered around -
 * see the display helpers in ./content.ts. A field that is *present and the
 * wrong shape* is still a rejection either way: that is a broken feed, not a
 * sparse one.
 */

import {
  type Certification,
  type Contact,
  type ContactLink,
  type Education,
  type Highlight,
  type Job,
  type Location,
  type PersonalProject,
  type Profile,
  type ResumeContent,
  type Role,
  type Skill,
  type SkillGroup,
  type Specific,
  type ViaEmployer,
  defaultContent,
} from "./content";

export const RESUME_FEED_URL = "https://resume.tristankerner.com/public/tristan/resume/resume.json";

/**
 * Versioned: a cached payload is re-read by whatever version of this module is
 * running, so bumping this is how a change here stops trying to read entries
 * written by the old one.
 */
export const CACHE_KEY = "about-me:resume:v2";

/**
 * How long a locally cached copy is served without asking the network at all.
 *
 * The resume changes a few times a year, and a visitor reading it for ten
 * minutes and reloading twice should cost the service nothing.
 */
export const CACHE_TTL_MS = 30 * 60 * 1000;

/** A hung request must not leave the page spinning indefinitely. */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Thrown by the readers and caught once, at the top. The alternative - every
 * reader returning `T | null` and every caller re-checking - buries the reading
 * in null handling, and this is a parser: the useful outcome of a bad field is
 * rejecting its payload, not patching around it.
 */
class InvalidFeed extends Error {}

/**
 * Rewrites the feed's conventions into this repo's, once, before anything looks
 * at a field: an explicit `null` becomes an absent key. The feed is already
 * camelCase (see the module docstring), so the snake_case rewrite here is a
 * no-op on today's payloads; it stays because a field added under the schema's
 * own convention is camelCase by definition and this keeps that safe either
 * way.
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), normalize(v)]),
  );
}

/** Reads one field. `field` is a dotted path, used only to describe failures. */
type Reader<T> = (value: unknown, field: string) => T;

const text: Reader<string> = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidFeed(`expected a non-empty string at ${field}`);
  }
  return value;
};

const optionalText: Reader<string | undefined> = (value) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

/** A field where `null` is the value, not its absence - see `normalize`. */
const nullable: Reader<string | null> = (value, field) =>
  value === undefined ? null : text(value, field);

/**
 * Keeps only absolute http(s) URLs, dropping anything else.
 *
 * Every URL in the feed is rendered into an `href`. Svelte does not sanitize
 * those, so a `javascript:` or `data:` URL - published upstream by mistake, or
 * injected by anything sitting between here and the service - would execute
 * with this page's origin the moment a visitor clicked a skill badge.
 *
 * Dropping just the URL rather than rejecting the entry is deliberate: a bad
 * link should cost that one link its hyperlink, not blank the resume.
 */
const safeUrl: Reader<string | undefined> = (value) => {
  const raw = optionalText(value, "");
  if (raw === undefined) return undefined;
  try {
    const { protocol } = new URL(raw);
    return protocol === "http:" || protocol === "https:" ? raw : undefined;
  } catch {
    return undefined;
  }
};

/** One of a fixed set. An unrecognised value is an error, not an omission. */
function literal<T extends string>(allowed: readonly T[]): Reader<T> {
  return (value, field) => {
    const raw = text(value, field);
    if (!(allowed as readonly string[]).includes(raw)) {
      throw new InvalidFeed(`expected one of [${allowed.join(", ")}] at ${field}, got "${raw}"`);
    }
    return raw as T;
  };
}

/**
 * Reads an object by applying one reader per field. The field map doubles as
 * the documentation of what this module requires of the feed - which is the
 * point of doing it this way rather than as a hand-written function each.
 *
 * The map's keys are the *feed's* field names: `shape` reads `raw[key]` for
 * each one. Where this page's own vocabulary diverges from the feed's (a job's
 * `company` is the feed's `work[].name`; a role's `start` is `startDate`), the
 * reader that calls `shape` reads into an intermediate value keyed by the
 * feed's names and renames the result afterward, rather than teaching `shape`
 * itself about two sets of names.
 */
function shape<T>(fields: { [K in keyof T]-?: Reader<T[K]> }): Reader<T> {
  return (value, field) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new InvalidFeed(`expected an object at ${field}`);
    }
    const raw = value as Record<string, unknown>;
    const out = {} as T;
    for (const key of Object.keys(fields) as (keyof T)[]) {
      const read = fields[key](raw[key as string], `${field}.${String(key)}`);
      // Keep absent optionals absent rather than writing an explicit
      // `undefined`, so the generated data file stays free of empty keys.
      if (read !== undefined) out[key] = read;
    }
    return out;
  };
}

function arrayOf<T>(item: Reader<T>): Reader<T[]> {
  return (value, field) => {
    if (!Array.isArray(value)) throw new InvalidFeed(`expected an array at ${field}`);
    return value.map((entry, i) => item(entry, `${field}[${i}]`));
  };
}

/** An object that may be absent entirely, such as a job's agency contract. */
function optionalOf<T>(inner: Reader<T>): Reader<T | undefined> {
  return (value, field) => (value === undefined ? undefined : inner(value, field));
}

const readLocation = shape<Location>({
  label: text,
  kind: literal(["residence", "metro", "remote"] as const),
  note: text,
});

/** `basics.profiles[]` entry -> this page's `ContactLink`: `network` is the label. */
const readProfileLink: Reader<ContactLink> = (value, field) => {
  const raw = shape<{ network: string; url: string }>({ network: text, url: text })(value, field);
  return { label: raw.network, url: raw.url };
};

/**
 * `basics.location` and `basics.additionalLocations[]` -> this page's
 * `Contact`. The feed keeps one preferred location separate from the rest;
 * this page has always treated them as a single ordered list with the
 * preferred one first, so the two are recombined here exactly as `remote.ts`
 * split them apart on the way in, before this migration, when the shapes
 * matched directly.
 */
const readContactFromBasics: Reader<Contact> = (value, field) => {
  const raw = shape<{
    location: Location | undefined;
    additionalLocations: Location[];
    profiles: ContactLink[];
  }>({
    location: optionalOf(readLocation),
    additionalLocations: arrayOf(readLocation),
    profiles: arrayOf(readProfileLink),
  })(value, field);

  return {
    locations: raw.location ? [raw.location, ...raw.additionalLocations] : raw.additionalLocations,
    links: raw.profiles,
  };
};

/** `basics.name` / `.label` / `.tagline` -> this page's `Profile`. */
const readProfile: Reader<Profile> = (value, field) => {
  const raw = shape<{ name: string; label: string | undefined; tagline: string | undefined }>({
    name: text,
    label: optionalText,
    tagline: optionalText,
  })(value, field);
  return { name: raw.name, title: raw.label, tagline: raw.tagline };
};

const readSkill = shape<Skill>({ name: text, url: safeUrl });

/**
 * `skills[]` entry -> this page's `SkillGroup`. The feed's `keywords[]`
 * becomes this page's `skills[]` - the individual entries a group is made of.
 *
 * Per-keyword `level` and `lastUsed` are never present here: the public feed
 * withholds them (see `Skill` in ./content.ts), so there is nothing to read.
 */
const readSkillGroup: Reader<SkillGroup> = (value, field) => {
  const raw = shape<{ name: string; keywords: Skill[] }>({
    name: text,
    keywords: arrayOf(readSkill),
  })(value, field);
  return { name: raw.name, skills: raw.keywords };
};

const readRole: Reader<Role> = (value, field) => {
  const raw = shape<{ title: string; startDate: string | undefined; endDate: string | null }>({
    title: text,
    startDate: optionalText,
    endDate: nullable,
  })(value, field);
  return { title: raw.title, start: raw.startDate, end: raw.endDate };
};

const readViaEmployer: Reader<ViaEmployer> = (value, field) => {
  const raw = shape<{
    name: string;
    startDate: string | undefined;
    endDate: string | undefined;
    engagement: "contract-to-hire" | "contract" | undefined;
  }>({
    name: text,
    startDate: optionalText,
    endDate: optionalText,
    engagement: optionalOf(literal(["contract-to-hire", "contract"] as const)),
  })(value, field);
  return { name: raw.name, start: raw.startDate, end: raw.endDate, engagement: raw.engagement };
};

/**
 * `specifics[]` entry -> `detail` only. The private payload's per-specific
 * `tech` list never reaches the public feed (see `Specific` in ./content.ts).
 */
const readSpecific = shape<Specific>({ detail: text });

const readHighlight = shape<Highlight>({
  id: text,
  summary: text,
  specifics: arrayOf(readSpecific),
});

/** `work[]` entry -> this page's `Job`. */
const readJob: Reader<Job> = (value, field) => {
  const raw = shape<{
    name: string;
    url: string | undefined;
    location: string | undefined;
    description: string | undefined;
    position: string | undefined;
    startDate: string | undefined;
    endDate: string | null;
    roleLocation: "On-site" | "Hybrid" | "Remote" | undefined;
    // An entry with no role history is read rather than rejected: `position`
    // is the schema's own headline title and stands in for it. See
    // `currentTitleText` in ./content.ts.
    roles: Role[];
    highlights: Highlight[];
    viaEmployer: ViaEmployer | undefined;
  }>({
    name: text,
    url: safeUrl,
    location: optionalText,
    description: optionalText,
    position: optionalText,
    startDate: optionalText,
    endDate: nullable,
    roleLocation: optionalOf(literal(["On-site", "Hybrid", "Remote"] as const)),
    roles: arrayOf(readRole),
    highlights: arrayOf(readHighlight),
    viaEmployer: optionalOf(readViaEmployer),
  })(value, field);

  return {
    company: raw.name,
    companyUrl: raw.url,
    companyLocation: raw.location,
    start: raw.startDate,
    end: raw.endDate,
    viaEmployer: raw.viaEmployer,
    description: raw.description,
    roleLocation: raw.roleLocation,
    position: raw.position,
    roles: raw.roles,
    highlights: raw.highlights,
  };
};

/** `education[]` entry -> this page's `Education`. */
const readEducation: Reader<Education> = (value, field) => {
  const raw = shape<{
    institution: string | undefined;
    studyType: string | undefined;
    area: string | undefined;
    endDate: string | undefined;
    location: string | undefined;
    url: string | undefined;
  }>({
    institution: optionalText,
    studyType: optionalText,
    area: optionalText,
    endDate: optionalText,
    location: optionalText,
    url: safeUrl,
  })(value, field);

  return {
    institution: raw.institution,
    credential: raw.studyType,
    field: raw.area,
    year: raw.endDate,
    location: raw.location,
    url: raw.url,
  };
};

/** `projects[]` entry -> this page's `PersonalProject`. */
const readPersonalProject: Reader<PersonalProject> = (value, field) => {
  const raw = shape<{
    name: string | undefined;
    url: string | undefined;
    description: string | undefined;
  }>({
    name: optionalText,
    url: safeUrl,
    description: optionalText,
  })(value, field);
  return { name: raw.name, link: raw.url, description: raw.description };
};

/** A certificate entry -> this page's `Certification`: `identifier` is the id. */
const readCertification: Reader<Certification> = (value, field) => {
  const raw = shape<{ name: string; identifier: string | undefined; url: string | undefined }>({
    name: text,
    identifier: optionalText,
    url: safeUrl,
  })(value, field);
  return { name: raw.name, id: raw.identifier, url: raw.url };
};

/**
 * Reads a section that nothing on the page renders, falling back to the
 * built-in copy if the feed's version is malformed.
 *
 * `contact` and `education` are carried because they are part of the resume,
 * not because anything displays them. Letting a blank tailoring note on a
 * location discard the entire live resume - every job, every skill - would be a
 * wildly disproportionate response to a field nobody sees.
 */
function section<T>(read: Reader<T>, value: unknown, field: string, fallback: T): T {
  try {
    return read(value, field);
  } catch (error) {
    if (error instanceof InvalidFeed) {
      console.warn(`Keeping the built-in ${field}: ${error.message}`);
      return fallback;
    }
    throw error;
  }
}

/**
 * Maps a parsed feed response onto this repo's types, or returns `null` if it
 * isn't one. The revision envelope (`revision_id`, `created_at`, ...) is
 * deliberately ignored: nothing on the page shows it, and reading it would make
 * this care about the envelope's shape as well as the resume's.
 */
export function toResumeContent(payload: unknown): ResumeContent | null {
  try {
    const envelope = normalize(payload);
    if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) {
      throw new InvalidFeed("expected an object at the top level");
    }
    const data = (envelope as Record<string, unknown>).data;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new InvalidFeed("expected an object at data");
    }
    const raw = data as Record<string, unknown>;
    const basics = raw.basics;
    if (typeof basics !== "object" || basics === null || Array.isArray(basics)) {
      throw new InvalidFeed("expected an object at basics");
    }

    return {
      profile: readProfile(basics, "basics"),
      contact: section(readContactFromBasics, basics, "basics", defaultContent.contact),
      summary: text((basics as Record<string, unknown>).summary, "basics.summary"),
      skillGroups: arrayOf(readSkillGroup)(raw.skills, "skills"),
      certifications: arrayOf(readCertification)(raw.certificates, "certificates"),
      jobs: arrayOf(readJob)(raw.work, "work"),
      education: section(
        arrayOf(readEducation),
        raw.education,
        "education",
        defaultContent.education,
      ),
      personalProjects: arrayOf(readPersonalProject)(raw.projects, "projects"),
    };
  } catch (error) {
    if (error instanceof InvalidFeed) {
      console.warn(`Ignoring the resume feed: ${error.message}`);
      return null;
    }
    throw error;
  }
}

type CacheEnvelope = { fetchedAt: number; payload: unknown };

/**
 * The most recent feed response, if one was stored within the TTL.
 *
 * Stores the raw payload rather than the mapped result, so that everything the
 * page renders has been through `toResumeContent` in the version of this module
 * that is actually running - a cache entry can never be a way for an older
 * mapping's output to skip today's validation.
 */
export function readCache(now: number = Date.now()): ResumeContent | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { fetchedAt, payload } = parsed as Partial<CacheEnvelope>;
    if (typeof fetchedAt !== "number") return null;
    const age = now - fetchedAt;
    // A negative age means the clock moved backwards (or the entry was
    // hand-written); treat it as unusable rather than as freshest-possible.
    if (age < 0 || age >= CACHE_TTL_MS) return null;
    return toResumeContent(payload);
  } catch {
    // Unparseable, or localStorage unavailable (private browsing, storage
    // disabled). Either way there's no cached copy to use.
    return null;
  }
}

export function writeCache(payload: unknown, now: number = Date.now()) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: now, payload } satisfies CacheEnvelope),
    );
  } catch {
    // Over quota, or storage disabled. The page still shows this response; it
    // just re-fetches on the next load instead of reading it back.
  }
}

/**
 * Fetches the feed and caches the response. Returns `null` on any failure,
 * which the page reads as "keep what you have".
 *
 * `fetchImpl` and `url` are injectable so tests can drive the failure paths
 * without a global stub, and so `bun run sync-resume` can point this at a
 * staging copy of the service.
 */
export async function fetchResume(
  fetchImpl: typeof fetch = fetch,
  url: string = RESUME_FEED_URL,
): Promise<ResumeContent | null> {
  const payload = await fetchFeed(fetchImpl, url);
  if (payload === null) return null;

  const content = toResumeContent(payload);
  // Only cache what read cleanly - caching an unreadable payload would just
  // replay the same failure for the next half hour.
  if (content) writeCache(payload);
  return content;
}

/**
 * The raw response, or `null` if it could not be retrieved.
 *
 * Separate from `fetchResume` because the sync command needs the payload
 * itself, not just the mapped result: what it writes to disk is derived from
 * the mapping, but a failure there has to be distinguishable from the service
 * being unreachable.
 */
export async function fetchFeed(
  fetchImpl: typeof fetch = fetch,
  url: string = RESUME_FEED_URL,
): Promise<unknown> {
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      // A public, unauthenticated feed: sending cookies would only make the
      // request's CORS requirements stricter for no benefit.
      credentials: "omit",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`The resume feed responded ${response.status}.`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn("Could not reach the resume feed.", error);
    return null;
  }
}
