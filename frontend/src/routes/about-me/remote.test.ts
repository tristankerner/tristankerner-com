import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CACHE_KEY,
  CACHE_TTL_MS,
  RESUME_FEED_URL,
  fetchResume,
  readCache,
  toResumeContent,
  writeCache,
} from "./remote";
import { feedPayload } from "./feed.fixture";
import { defaultContent } from "./content";

/**
 * The resume body inside the fixture's envelope, typed loosely on purpose.
 *
 * Most of the tests below exist to build payloads the feed's own types would
 * reject - a number where a date belongs, an unknown enum value, a missing
 * required field. Reaching through a precise type to write those would mean a
 * cast per call site, which reads as noise and hides what each case is
 * actually malforming.
 */
// oxlint-disable-next-line no-explicit-any
type LooseFeed = Record<string, any>;

/** The fixture, with `mutate` applied to the resume body inside the envelope. */
function feedWith(mutate: (data: LooseFeed) => void): Record<string, unknown> {
  const payload = feedPayload();
  mutate(payload.data as LooseFeed);
  return payload;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
  // Rejecting a feed is a console.warn by design - useful in a browser, noise
  // here. Spied rather than silenced so tests can assert it happened.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toResumeContent", () => {
  it("maps a full feed response onto the page's types", () => {
    const content = toResumeContent(feedPayload());
    if (!content) throw new Error("expected the fixture feed to map");

    expect(content.profile).toEqual({
      name: "Feed Profile Name",
      title: "Feed Profile Title",
      tagline: "Feed Profile Tagline",
    });
    expect(content.summary).toBe("Feed summary paragraph.");
    expect(content.contact.locations[0].kind).toBe("remote");
    expect(content.skillGroups[0].skills[0]).toEqual({
      name: "Feed Linked Skill",
      url: "https://example.com/skill",
    });
    expect(content.education[0].credential).toBe("Feed Credential");
    expect(content.personalProjects[1].link).toBe("https://example.com/project");
  });

  it("renames the feed's official JSON Resume field names to the ones the page reads", () => {
    const content = toResumeContent(feedPayload());
    const [job] = content?.jobs ?? [];

    expect(job.companyUrl).toBe("https://example.com/company");
    expect(job.companyLocation).toBe("Feed City, ST");
    expect(job.roleLocation).toBe("Remote");
    expect(job.viaEmployer?.name).toBe("Feed Staffing Agency");
  });

  // The feed sends null for an unset optional; these types spell that
  // `undefined`, and `{ id: null }` would render as the string "null".
  it("turns the feed's nulls into absent optional fields", () => {
    const content = toResumeContent(feedPayload());

    expect(content?.certifications[1].id).toBeUndefined();
    expect(content?.certifications[1].url).toBeUndefined();
    expect(content?.education[0].institution).toBeUndefined();
    expect(content?.personalProjects[0].name).toBeUndefined();
  });

  // ...except on an end date, where null is the value, not its absence.
  it("keeps a null end date as null, meaning still current", () => {
    const content = toResumeContent(feedPayload());

    expect(content?.jobs[0].end).toBeNull();
    expect(content?.jobs[0].roles[0].end).toBeNull();
    expect(content?.jobs[0].roles[1].end).toBe("2024");
  });

  it("rejects an end date that is neither a date nor null", () => {
    expect(toResumeContent(feedWith((data) => (data.work[0].endDate = 2026)))).toBeNull();
  });

  it.each([
    ["not an object", "nope"],
    ["null", null],
    ["an envelope with no data", { revision_id: 1 }],
    ["a missing basics", feedWith((data) => delete data.basics)],
    ["a basics field of the wrong type", feedWith((data) => (data.basics.name = 42))],
    ["a blank summary", feedWith((data) => (data.basics.summary = "   "))],
    ["skills that aren't an array", feedWith((data) => (data.skills = {}))],
    ["a certificate with no name", feedWith((data) => (data.certificates = [{ identifier: "1" }]))],
    ["an unknown role location", feedWith((data) => (data.work[0].roleLocation = "Lunar"))],
    [
      "an unknown engagement",
      feedWith((data) => (data.work[0].viaEmployer.engagement = "permanent")),
    ],
    ["a job with no roles", feedWith((data) => (data.work[0].roles = []))],
    [
      "a highlight specific with no detail",
      feedWith((data) => (data.work[0].highlights[0].specifics = [{ detail: 7 }])),
    ],
    ["a project with no description", feedWith((data) => (data.projects = [{ name: "x" }]))],
  ])("returns null for %s", (_case, payload) => {
    expect(toResumeContent(payload)).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  // The page puts these straight into href attributes, which Svelte does not
  // sanitize - see safeUrl in remote.ts.
  it.each(["javascript:alert(1)", "data:text/html,<script>", "not a url at all"])(
    "drops the unsafe url %s but keeps the entry it belongs to",
    (url) => {
      const content = toResumeContent(feedWith((data) => (data.skills[0].keywords[0].url = url)));
      const [skill] = content?.skillGroups[0].skills ?? [];

      expect(skill.name).toBe("Feed Linked Skill");
      // Absent, not present-and-undefined: `bun run sync-resume` writes this
      // straight to disk, and an explicit `url: undefined` would be noise in
      // the generated file.
      expect("url" in skill).toBe(false);
    },
  );

  // contact and education are part of the resume but nothing renders them, so
  // a problem in either costs that section rather than the whole page.
  it.each([
    ["contact", (data: LooseFeed) => (data.basics.location.kind = "orbital")],
    ["education", (data: LooseFeed) => (data.education = [{ studyType: "" }])],
  ])("falls back to the built-in %s without discarding the live resume", (name, break_) => {
    const content = toResumeContent(feedWith(break_));

    expect(content?.[name as "contact" | "education"]).toEqual(
      defaultContent[name as "contact" | "education"],
    );
    // The rest of the payload is still the live one.
    expect(content?.profile.name).toBe("Feed Profile Name");
    expect(content?.jobs[0].company).toBe("Feed Current Company");
  });

  it("keeps http and https urls", () => {
    const content = toResumeContent(
      feedWith((data) => (data.skills[0].keywords[0].url = "http://example.com/x")),
    );

    expect(content?.skillGroups[0].skills[0].url).toBe("http://example.com/x");
  });

  // Per-keyword level and lastUsed are a candid self-assessment of a publicly
  // listed inventory, so the public feed never carries them - even if a
  // malformed payload tried to.
  it("never exposes a skill level or lastUsed, even if the feed sends one", () => {
    const content = toResumeContent(
      feedWith((data) => {
        const keyword = data.skills[0].keywords[0];
        keyword.level = "expert";
        keyword.lastUsed = "2026";
      }),
    );
    expect(content?.skillGroups[0].skills[0]).toEqual({
      name: "Feed Linked Skill",
      url: "https://example.com/skill",
    });
  });

  it("treats a job without an agency contract as having none", () => {
    const content = toResumeContent(feedWith((data) => (data.work[0].viaEmployer = null)));

    expect(content?.jobs[0].viaEmployer).toBeUndefined();
  });
});

describe("the local cache", () => {
  it("reads back what it wrote", () => {
    writeCache(feedPayload());

    expect(readCache()?.profile.name).toBe("Feed Profile Name");
  });

  it("is empty before anything is written", () => {
    expect(readCache()).toBeNull();
  });

  it("ignores an entry older than the ttl", () => {
    const written = Date.now();
    writeCache(feedPayload(), written);

    expect(readCache(written + CACHE_TTL_MS - 1)).not.toBeNull();
    expect(readCache(written + CACHE_TTL_MS)).toBeNull();
  });

  // A clock that moved backwards would otherwise make an entry look permanently
  // fresh rather than merely stale.
  it("ignores an entry stamped in the future", () => {
    const written = Date.now();
    writeCache(feedPayload(), written);

    expect(readCache(written - 1)).toBeNull();
  });

  it.each([
    ["unparseable", "not json"],
    ["missing its timestamp", JSON.stringify({ payload: feedPayload() })],
    [
      "holding a payload this version can't read",
      JSON.stringify({ fetchedAt: Date.now(), payload: {} }),
    ],
  ])("ignores an entry that is %s", (_case, stored) => {
    localStorage.setItem(CACHE_KEY, stored);

    expect(readCache()).toBeNull();
  });

  it("swallows a read failure instead of throwing", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(readCache()).toBeNull();
  });

  it("swallows a write failure instead of throwing", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => writeCache(feedPayload())).not.toThrow();
  });
});

describe("fetchResume", () => {
  it("requests the public feed and maps the response", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(feedPayload())));

    const content = await fetchResume(fetchImpl as unknown as typeof fetch);

    expect(content?.profile.name).toBe("Feed Profile Name");
    expect(fetchImpl).toHaveBeenCalledWith(
      RESUME_FEED_URL,
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("caches a response it could map", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(feedPayload())));

    await fetchResume(fetchImpl as unknown as typeof fetch);

    expect(readCache()?.profile.name).toBe("Feed Profile Name");
  });

  // Caching an unreadable payload would replay the same failure for a full TTL
  // instead of retrying on the next load.
  it("does not cache a response it could not map", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ data: "nonsense" })));

    expect(await fetchResume(fetchImpl as unknown as typeof fetch)).toBeNull();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("returns null for an error status", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({}, 503)));

    expect(await fetchResume(fetchImpl as unknown as typeof fetch)).toBeNull();
  });

  // A missing CORS header, an offline browser, and a timeout are all reported
  // to a page as the same opaque rejection.
  it("returns null when the request rejects", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));

    expect(await fetchResume(fetchImpl as unknown as typeof fetch)).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("returns null when the response body isn't json", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token <")),
      } as unknown as Response),
    );

    expect(await fetchResume(fetchImpl as unknown as typeof fetch)).toBeNull();
  });
});
