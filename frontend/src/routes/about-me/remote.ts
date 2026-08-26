/**
 * Reads the about-me page's content from the resume microservice, so a revision
 * published there is live here without a redeploy.
 *
 * Three things shape everything below.
 *
 * The feed is a *different service's* wire format. It is snake_case, wraps the
 * resume in a revision envelope, and sends `null` where these types use an
 * absent field. `normalize` deals with all three mechanically, so the readers
 * further down describe the resume rather than the transport.
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
  type SkillGroup,
  type ViaEmployer,
  defaultContent,
} from "./content";

export const RESUME_FEED_URL = "https://resume.tristankerner.com/public/tristan/resume/resume.json";

/**
 * Versioned: a cached payload is re-read by whatever version of this module is
 * running, so bumping this is how a change here stops trying to read entries
 * written by the old one.
 */
export const CACHE_KEY = "about-me:resume:v1";

/**
 * How long a locally cached copy is served without asking the network at all.
 *
 * The resume changes a few times a year, and a visitor reading it for ten
 * minutes and reloading twice should cost the service nothing.
 */
export const CACHE_TTL_MS = 30 * 60 * 1000;

/** A hung request must not leave the page spinning indefinitely. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Thrown by the readers and caught once, at the top. The alternative - every
 * reader returning `T | null` and every caller re-checking - buries the reading
 * in null handling, and this is a parser: the useful outcome of a bad field is
 * rejecting its payload, not patching around it.
 */
class InvalidFeed extends Error {}

/**
 * Rewrites the feed's conventions into this repo's, once, before anything looks
 * at a field: `company_url` becomes `companyUrl`, and an explicit `null`
 * becomes an absent key.
 *
 * Doing it here rather than field by field is what keeps the readers below
 * short. The one place it needs care is a `null` end date, which means "still
 * current" rather than "missing" - `nullable` puts that back, and is used only
 * where a null is genuinely meaningful.
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

/** As `literal`, but an unrecognised value is dropped rather than rejected. */
function optionalLiteral<T extends string>(allowed: readonly T[]): Reader<T | undefined> {
  return (value) => (allowed as readonly string[]).find((a) => a === value) as T | undefined;
}

/**
 * Reads an object by applying one reader per field. The field map doubles as
 * the documentation of what this module requires of the feed - which is the
 * point of doing it this way rather than as a hand-written function each.
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

function arrayOf<T>(item: Reader<T>, minLength = 0): Reader<T[]> {
  return (value, field) => {
    if (!Array.isArray(value)) throw new InvalidFeed(`expected an array at ${field}`);
    if (value.length < minLength) {
      throw new InvalidFeed(`expected at least ${minLength} entries at ${field}`);
    }
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

const readContact = shape<Contact>({
  locations: arrayOf(readLocation),
  links: arrayOf(shape<ContactLink>({ label: text, url: text })),
});

const readSkillGroup = shape<SkillGroup>({
  name: text,
  skills: arrayOf(
    shape({
      name: text,
      url: safeUrl,
      level: optionalLiteral(["expert", "working", "familiar"] as const),
      lastUsed: optionalText,
    }),
  ),
});

const readRole = shape<Role>({ title: text, start: text, end: nullable });

const readJob = shape<Job>({
  company: text,
  companyUrl: safeUrl,
  companyLocation: text,
  start: text,
  end: nullable,
  viaEmployer: optionalOf(
    shape<ViaEmployer>({
      name: text,
      start: text,
      end: text,
      engagement: literal(["contract-to-hire", "contract"] as const),
    }),
  ),
  description: text,
  roleLocation: literal(["On-site", "Hybrid", "Remote"] as const),
  // The page reads roles[0] unconditionally for the current title; a job with
  // none would render `undefined` rather than fail here, which is worse.
  roles: arrayOf(readRole, 1),
  highlights: arrayOf(shape<Highlight>({ id: text, summary: text, specifics: arrayOf(text) })),
});

const readEducation = shape<Education>({
  institution: optionalText,
  credential: text,
  field: optionalText,
  year: optionalText,
  location: optionalText,
  url: safeUrl,
});

const readPersonalProject = shape<PersonalProject>({
  name: optionalText,
  link: safeUrl,
  description: text,
});

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

    return {
      profile: shape<Profile>({ name: text, title: text, tagline: text })(raw.profile, "profile"),
      contact: section(readContact, raw.contact, "contact", defaultContent.contact),
      summary: text(raw.summary, "summary"),
      skillGroups: arrayOf(readSkillGroup)(raw.skillGroups, "skillGroups"),
      certifications: arrayOf(shape<Certification>({ name: text, id: optionalText, url: safeUrl }))(
        raw.certifications,
        "certifications",
      ),
      jobs: arrayOf(readJob)(raw.jobs, "jobs"),
      education: section(
        arrayOf(readEducation),
        raw.education,
        "education",
        defaultContent.education,
      ),
      personalProjects: arrayOf(readPersonalProject)(raw.personalProjects, "personalProjects"),
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
