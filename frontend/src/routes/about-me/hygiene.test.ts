import { describe, expect, it } from "vitest";
import { certifications, jobs, skillGroups, summary } from "./content";

/**
 * Mechanical checks over the resume content itself, rather than over the code
 * that renders it.
 *
 * Stray whitespace here is not cosmetic: a trailing space in a `specifics`
 * entry once broke the page test suite outright, because Testing Library
 * normalizes the DOM text it finds but not the string you query with. And every
 * one of these strings can end up in a generated resume, where a double space
 * or a missing period is visible to whoever is reading it.
 */

// Every string in the content module, paired with a path so a failure says
// which one. Walks the real exports so new fields are covered automatically.
function contentStrings(): [string, string][] {
  const entries: [string, string][] = [["summary", summary]];

  for (const group of skillGroups) {
    entries.push([`skillGroups.${group.name}`, group.name]);
    for (const skill of group.skills) entries.push([`skill.${skill.name}`, skill.name]);
  }

  for (const cert of certifications) entries.push([`certification.${cert.name}`, cert.name]);

  for (const job of jobs) {
    entries.push([`${job.company}.description`, job.description]);
    for (const role of job.roles) entries.push([`${job.company}.role`, role.title]);

    for (const highlight of job.highlights) {
      const where = `${job.company}: ${highlight.summary.slice(0, 40)}`;
      entries.push([`${where} (summary)`, highlight.summary]);
      for (const specific of highlight.specifics) {
        entries.push([`${where} (specific)`, specific.detail]);
      }
    }
  }

  return entries;
}

// Sentences that end in prose. Tech tags, skill names, and titles
// are labels, not sentences, so they are excluded from the punctuation rule.
function proseStrings(): [string, string][] {
  const entries: [string, string][] = [["summary", summary]];

  for (const job of jobs) {
    for (const highlight of job.highlights) {
      const where = `${job.company}: ${highlight.summary.slice(0, 40)}`;
      entries.push([`${where} (summary)`, highlight.summary]);
      for (const specific of highlight.specifics) {
        entries.push([`${where} (specific)`, specific.detail]);
      }
    }
  }

  return entries;
}

describe("resume content hygiene", () => {
  it("has no leading or trailing whitespace anywhere", () => {
    const offenders = contentStrings()
      .filter(([, value]) => value !== value.trim())
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("has no doubled spaces or stray newlines", () => {
    const offenders = contentStrings()
      .filter(([, value]) => /\s\s/.test(value))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("ends every piece of prose with terminal punctuation", () => {
    const offenders = proseStrings()
      .filter(([, value]) => !/[.!?]$/.test(value))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("has no duplicated words", () => {
    const offenders = proseStrings()
      .filter(([, value]) => /\b(\w+)\s+\1\b/i.test(value))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  // Highlight summaries are keyed by text in the page's {#each}, so a duplicate
  // is a runtime crash, not just a redundant bullet.
  it("has no duplicate highlight summaries within a job", () => {
    for (const job of jobs) {
      const summaries = job.highlights.map((highlight) => highlight.summary);
      expect(new Set(summaries).size).toBe(summaries.length);
    }
  });

  it("has no duplicate certification names", () => {
    const names = certifications.map((cert) => cert.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
