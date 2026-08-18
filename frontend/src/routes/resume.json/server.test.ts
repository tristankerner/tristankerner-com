import { describe, expect, it } from "vitest";
import {
  certifications,
  education,
  jobDurationText,
  jobs,
  profile,
  roleDurationText,
} from "../about-me/content";
import { GET, prerender } from "./+server.ts";
import { buildResume } from "./payload";
import { README, SCHEMA_URL, SCHEMA_VERSION, resumeSchema, type SchemaNode } from "./schema";

/**
 * Walks the payload alongside the schema and reports every path whose key the
 * schema does not describe. This is the drift guard: adding a field to
 * content.ts without documenting it fails here, so the feed can never ship
 * data that a consumer has no definition for.
 */
const undocumentedPaths = (
  value: unknown,
  schema: SchemaNode | undefined,
  path: string,
): string[] => {
  if (!schema) return [path];
  if (Array.isArray(value)) {
    return value.flatMap((entry, i) => undocumentedPaths(entry, schema.items, `${path}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      undocumentedPaths(entry, schema.properties?.[key], `${path}.${key}`),
    );
  }
  return [];
};

const describedlessPaths = (schema: SchemaNode, path: string): string[] => [
  ...(schema.description ? [] : [path]),
  ...Object.entries(schema.properties ?? {}).flatMap(([key, child]) =>
    describedlessPaths(child, `${path}.${key}`),
  ),
  ...(schema.items ? describedlessPaths(schema.items, `${path}[]`) : []),
];

describe("GET /resume.json", () => {
  it("prerenders", () => {
    expect(prerender).toBe(true);
  });

  it("returns parseable JSON with the right content type", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(await res.text())).toEqual(
      // buildResume() stamps the current date, so compare against a fresh call
      // rather than a frozen fixture.
      expect.objectContaining({ $schema: SCHEMA_URL }),
    );
  });

  it("carries provenance and the usage readme in meta", () => {
    const { meta } = buildResume();
    expect(meta.version).toBe(SCHEMA_VERSION);
    expect(meta.generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(meta.canonical).toBe("https://tristankerner.com/resume.json");
    expect(meta.humanPage).toBe("https://tristankerner.com/about-me");
    expect(meta.readme).toBe(README);
  });

  it("tells consumers not to embellish credentials", () => {
    expect(README).toMatch(/never upgrade one/);
  });

  it("tells consumers never to drop a contract-to-hire window", () => {
    expect(README).toMatch(/viaEmployer/);
    expect(README).toMatch(/Never drop it/);
  });

  it("tells consumers to ask for the contact details the feed withholds", () => {
    expect(README).toMatch(/no email or phone number in this feed/);
    expect(README).toMatch(/Ask for both and wait for an answer/);
  });

  // The feed is public and unauthenticated, so direct contact details stay out
  // of it entirely rather than being published in machine-readable form.
  it("publishes no email address or phone number anywhere in the payload", () => {
    const serialized = JSON.stringify(buildResume().basics);
    expect(serialized).not.toMatch(/@\w+\.\w/);
    expect(serialized).not.toMatch(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/);
  });

  it("exposes the resume header details the about-me page does not render", () => {
    const { basics } = buildResume();
    expect(basics.name).toBe(profile.name);
    expect(basics.locations.length).toBeGreaterThan(0);
    for (const location of basics.locations) {
      expect(location.note).not.toBe("");
    }
    expect(basics.links.map((link) => link.label)).toContain("LinkedIn");
  });

  it("carries every job and certification from the shared content source", () => {
    const resume = buildResume();
    // work[] is jobs[] plus derived display prose, so compare field by field
    // rather than whole-object.
    expect(resume.work.map((job) => job.company)).toEqual(jobs.map((job) => job.company));
    for (const [i, job] of resume.work.entries()) {
      expect(job.highlights).toEqual(jobs[i].highlights);
      expect(job.roles.map((role) => role.title)).toEqual(jobs[i].roles.map((role) => role.title));
    }
    expect(resume.certifications).toEqual(certifications);
    expect(resume.education).toEqual(education);
  });

  // content.ts stores only start/end; the feed adds the display string back so a
  // consumer never has to format dates itself.
  it("derives display prose from the stored dates on every job and role", () => {
    for (const job of buildResume().work) {
      expect(job.start).toMatch(/^\d{4}-\d{2}$/);
      if (job.end !== null) expect(job.end).toMatch(/^\d{4}-\d{2}$/);
      expect(job.duration).toBe(jobDurationText(job));

      for (const role of job.roles) {
        expect(role.duration).toBe(roleDurationText(role));
      }
    }
  });

  it("keeps the derived prose out of the source data, so the two cannot disagree", () => {
    for (const job of jobs) {
      expect(job).not.toHaveProperty("duration");
      for (const role of job.roles) {
        expect(role).not.toHaveProperty("duration");
      }
    }
  });

  /**
   * The standing guard on this feed. Quantified outcomes, their provenance, and
   * the first-person cover-letter material were deliberately moved out of the
   * repo and into the private fine-tune-resume skill, because publishing them
   * would disclose a former employer's internal scale, spend, and headcount at a
   * URL anyone can fetch.
   *
   * Deleting the types made that structurally hard - re-adding a metric is a
   * compile error, not a typo. This catches the other half: someone reinstating
   * the field on the type and then populating it. It walks every key at every
   * depth rather than string-matching, so a rename to `figures` or `stats` is
   * caught by the shape of the data, not by the word chosen for it.
   */
  describe("withheld data never reaches the public feed", () => {
    const FORBIDDEN = ["metrics", "metricsNeeded", "metric", "basis", "narrative", "tech"];

    const keysAtEveryDepth = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.flatMap(keysAtEveryDepth);
      if (value !== null && typeof value === "object") {
        return Object.entries(value).flatMap(([key, child]) => [key, ...keysAtEveryDepth(child)]);
      }
      return [];
    };

    it("emits no metrics, provenance, or narrative key at any depth", () => {
      const present = keysAtEveryDepth(buildResume()).filter((key) => FORBIDDEN.includes(key));
      expect(present).toEqual([]);
    });

    it("declares no schema for them either, so re-adding one fails documentation too", () => {
      const declared = keysAtEveryDepth(resumeSchema).filter((key) => FORBIDDEN.includes(key));
      expect(declared).toEqual([]);
    });

    it("keeps the source content free of them, so nothing is one payload edit away", () => {
      const present = keysAtEveryDepth(jobs).filter((key) => FORBIDDEN.includes(key));
      expect(present).toEqual([]);
    });

    it("tells consumers the figures are withheld rather than absent by oversight", () => {
      expect(README).toMatch(/There is no separate metrics field, and there never will be/);
      expect(README).toMatch(/never derive, extrapolate, or estimate a/);
      expect(README).toMatch(/no first-person or cover-letter material in this feed/);
      expect(README).toMatch(/Technology keywords are not in this feed/);
      expect(README).toMatch(/never infer them/);
    });
  });

  /**
   * The private skill keys its per-bullet figures and technologies on
   * `highlight.id`. A duplicate or missing id would silently attribute one
   * bullet's tools to another - the exact failure that makes a tailored resume
   * claim the wrong stack for the wrong employer.
   */
  describe("highlight ids stay usable as a join key", () => {
    const ids = jobs.flatMap((job) => job.highlights.map((highlight) => highlight.id));

    it("gives every highlight an id", () => {
      expect(ids.filter((id) => !id)).toEqual([]);
      expect(ids.length).toBe(jobs.flatMap((job) => job.highlights).length);
    });

    it("keeps every id unique across all jobs", () => {
      const seen = new Set<string>();
      const duplicates = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
      expect(duplicates).toEqual([]);
    });

    it("uses slugs, so an id survives being read and typed by hand", () => {
      expect(ids.filter((id) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toEqual([]);
    });

    it("ships them in the feed, since the join happens consumer-side", () => {
      const emitted = buildResume().work.flatMap((job) =>
        job.highlights.map((highlight) => highlight.id),
      );
      expect(emitted).toEqual(ids);
    });
  });

  it("documents every field it emits", () => {
    expect(undocumentedPaths(buildResume(), resumeSchema, "$")).toEqual([]);
  });

  it("describes every field the schema declares", () => {
    expect(describedlessPaths(resumeSchema, "$")).toEqual([]);
  });
});
