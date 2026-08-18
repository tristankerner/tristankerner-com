import { describe, expect, it } from "vitest";
import {
  jobDurationText,
  jobs,
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
});

describe("promotedThroughText", () => {
  it("returns an empty string when there is only one role", () => {
    expect(
      promotedThroughText({ roles: [{ title: "Engineer", start: "2020", end: "2024" }] }),
    ).toBe("");
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
      expect(job.viaEmployer.start).toBe(job.start);
      expect(job.viaEmployer.end > job.viaEmployer.start).toBe(true);
      if (job.end !== null) expect(job.viaEmployer.end < job.end).toBe(true);
    }
  });
});
