import { describe, expect, it } from "vitest";
import {
  companyContextText,
  currentRoleText,
  currentTitleText,
  jobDurationText,
  jobs,
  personalProjects,
  profile,
  promotedThroughText,
  roleDurationText,
  viaEmployerText,
} from "./content";

// Synthetic fixtures, independent of the real resume data in content.ts, so
// these keep testing the generation logic even as that content changes.
describe("jobDurationText", () => {
  it("spells out the month and year on both ends", () => {
    expect(jobDurationText({ start: "2022-08", end: "2026-05" })).toBe("August 2022 - May 2026");
  });

  it("handles the first and last months of the year", () => {
    expect(jobDurationText({ start: "2013-01", end: "2014-12" })).toBe(
      "January 2013 - December 2014",
    );
  });

  it("reads a null end as still current", () => {
    expect(jobDurationText({ start: "2024-03", end: null })).toBe("March 2024 - Present");
  });

  it("says nothing rather than half a range when there is no start", () => {
    expect(jobDurationText({ end: "2026-05" })).toBe("");
    expect(jobDurationText({ end: null })).toBe("");
  });

  // Better to render something odd than to crash the whole page on a typo.
  it("falls back to the raw value when the input is not YYYY-MM", () => {
    expect(jobDurationText({ start: "whenever", end: "2020-13" })).toBe("whenever - 2020-13");
  });
});

describe("roleDurationText", () => {
  it("joins the start and end years", () => {
    expect(roleDurationText({ start: "2024", end: "2026" })).toBe("2024 - 2026");
  });

  it("reads a null end as still held", () => {
    expect(roleDurationText({ start: "2024", end: null })).toBe("2024 - Present");
  });

  it("says nothing for an undated role", () => {
    expect(roleDurationText({ end: null })).toBe("");
  });
});

describe("currentTitleText", () => {
  it("prefers the newest role", () => {
    expect(
      currentTitleText({
        roles: [{ title: "Senior Engineer", end: null }],
        position: "Engineer",
      }),
    ).toBe("Senior Engineer");
  });

  it("falls back to the feed's own position when there is no role history", () => {
    expect(currentTitleText({ roles: [], position: "Engineer" })).toBe("Engineer");
  });

  it("returns an empty string when the entry names no title at all", () => {
    expect(currentTitleText({ roles: [] })).toBe("");
  });
});

describe("currentRoleText", () => {
  it("joins the role's dates and where the work was done", () => {
    expect(
      currentRoleText({
        roles: [{ title: "Engineer", start: "2024", end: null }],
        roleLocation: "Remote",
      }),
    ).toBe("2024 - Present · Remote");
  });

  it("drops the separator along with whichever half is missing", () => {
    expect(currentRoleText({ roles: [], roleLocation: "Remote" })).toBe("Remote");
    expect(currentRoleText({ roles: [{ title: "Engineer", start: "2024", end: null }] })).toBe(
      "2024 - Present",
    );
    expect(currentRoleText({ roles: [] })).toBe("");
  });
});

describe("companyContextText", () => {
  it("joins where the company is and what it does", () => {
    expect(companyContextText({ companyLocation: "Austin, TX", description: "Payments" })).toBe(
      "Austin, TX · Payments",
    );
  });

  it("drops the separator along with whichever half is missing", () => {
    expect(companyContextText({ companyLocation: "Austin, TX" })).toBe("Austin, TX");
    expect(companyContextText({ description: "Payments" })).toBe("Payments");
    expect(companyContextText({})).toBe("");
  });
});

describe("viaEmployerText", () => {
  it("names the agency and the contract window", () => {
    expect(
      viaEmployerText({
        viaEmployer: {
          name: "Some Agency",
          start: "2022-08",
          end: "2023-01",
          engagement: "contract-to-hire",
        },
      }),
    ).toBe("Contract via Some Agency, August 2022 - January 2023");
  });

  it("returns an empty string for direct employment", () => {
    expect(viaEmployerText({})).toBe("");
  });

  it("names the agency without a window when the dates are absent", () => {
    expect(viaEmployerText({ viaEmployer: { name: "Some Agency" } })).toBe(
      "Contract via Some Agency",
    );
  });
});

describe("promotedThroughText", () => {
  it("returns an empty string when there is only one role", () => {
    expect(
      promotedThroughText({ roles: [{ title: "Engineer", start: "2020", end: "2024" }] }),
    ).toBe("");
  });

  it("names an undated prior role without an empty bracket after it", () => {
    expect(
      promotedThroughText({
        roles: [
          { title: "Senior Engineer", start: "2022", end: null },
          { title: "Engineer", end: "2022" },
        ],
      }),
    ).toBe("Promoted through Engineer.");
  });

  it("mentions a single prior role with its duration", () => {
    expect(
      promotedThroughText({
        roles: [
          { title: "Senior Engineer", start: "2022", end: "2024" },
          { title: "Engineer", start: "2020", end: "2022" },
        ],
      }),
    ).toBe("Promoted through Engineer (2020 - 2022).");
  });

  it("joins two prior roles with an oxford comma", () => {
    expect(
      promotedThroughText({
        roles: [
          { title: "Senior Engineer", start: "2023", end: "2024" },
          { title: "Engineer", start: "2021", end: "2023" },
          { title: "Junior Engineer", start: "2019", end: "2021" },
        ],
      }),
    ).toBe("Promoted through Engineer (2021 - 2023), and Junior Engineer (2019 - 2021).");
  });

  it("joins three or more prior roles with commas and a trailing oxford comma", () => {
    expect(
      promotedThroughText({
        roles: [
          { title: "Staff Engineer", start: "2023", end: "2024" },
          { title: "Senior Engineer", start: "2021", end: "2023" },
          { title: "Engineer", start: "2019", end: "2021" },
          { title: "Junior Engineer", start: "2018", end: "2019" },
        ],
      }),
    ).toBe(
      "Promoted through Senior Engineer (2021 - 2023), Engineer (2019 - 2021), and Junior Engineer (2018 - 2019).",
    );
  });
});

// The feed's schema marks almost every field below optional, and remote.ts
// reads them that way so one absent field cannot cost the page every section
// (see its module docstring). This resume nonetheless carries all of them,
// which is what lets the page and docx tests assert on them directly instead
// of guarding each one. If that ever stops being true, this fails first and
// says so, rather than those tests quietly asserting on `undefined`.
describe("the real content", () => {
  it("carries every optional field the rendering tests assert on", () => {
    expect(profile.title).toBeTypeOf("string");
    expect(profile.tagline).toBeTypeOf("string");

    for (const job of jobs) {
      expect(job.companyLocation).toBeTypeOf("string");
      expect(job.description).toBeTypeOf("string");
      expect(job.roleLocation).toBeTypeOf("string");
      expect(job.roles.length).toBeGreaterThan(0);
    }

    for (const project of personalProjects) {
      expect(project.description).toBeTypeOf("string");
    }
  });
});

// Guards the real content against the typo the derivation can no longer catch
// for us now that the display prose isn't written out by hand.
describe("the real job data", () => {
  it("gives every job and role dates the formatters can read", () => {
    for (const job of jobs) {
      expect(job.start).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      if (job.end !== null) expect(job.end).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      expect(jobDurationText(job)).toMatch(/^[A-Z][a-z]+ \d{4} - ([A-Z][a-z]+ \d{4}|Present)$/);

      for (const role of job.roles) {
        expect(role.start).toMatch(/^\d{4}$/);
        if (role.end !== null) expect(role.end).toMatch(/^\d{4}$/);
      }
    }
  });

  // The whole point of viaEmployer is that the resume's dates reconcile with
  // the employer of record, so the window has to sit inside the engagement and
  // start where the engagement starts.
  it("keeps any contract window aligned with its job's own dates", () => {
    for (const job of jobs) {
      if (!job.viaEmployer) continue;
      const { start, end } = job.viaEmployer;
      expect(start).toBe(job.start);
      expect(end).toBeTypeOf("string");
      expect(end! > start!).toBe(true);
      if (job.end !== null) expect(end! < job.end).toBe(true);
    }
  });
});
