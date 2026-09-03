/**
 * A complete, valid response from the resume microservice, for tests that need
 * one.
 *
 * Every value is deliberately unlike the content compiled into the build, so an
 * assertion that finds it has necessarily found live data rather than the
 * defaults the page starts with. The shape - JSON Resume's `basics`/`work`/
 * `education`/`certificates`/`skills`/`projects`, camelCase fields, a revision
 * envelope around `data`, `null` rather than an absent key for an unset
 * optional - mirrors the real feed; see remote.ts for why that matters.
 *
 * Returns a fresh object each call so a test can mutate it to describe a
 * malformed feed without affecting the next one.
 */
export function feedPayload(): Record<string, unknown> {
  return {
    name: "resume.json",
    revision_id: 7,
    revision_note: "Fixture revision.",
    type: "resume",
    public: true,
    created_at: "2026-08-26T21:50:42.899419",
    data: {
      basics: {
        name: "Feed Profile Name",
        label: "Feed Profile Title",
        tagline: "Feed Profile Tagline",
        summary: "Feed summary paragraph.",
        location: { label: "Feed Location", kind: "remote", note: "Feed location note." },
        additionalLocations: [],
        profiles: [{ network: "Website", url: "https://example.com/feed" }],
      },
      work: [
        {
          name: "Feed Current Company",
          url: "https://example.com/company",
          location: "Feed City, ST",
          description: "Feed company description.",
          startDate: "2022-08",
          endDate: null,
          viaEmployer: {
            name: "Feed Staffing Agency",
            startDate: "2022-08",
            endDate: "2023-01",
            engagement: "contract-to-hire",
          },
          roleLocation: "Remote",
          roles: [
            { title: "Feed Senior Role", startDate: "2024", endDate: null },
            { title: "Feed Junior Role", startDate: "2022", endDate: "2024" },
          ],
          highlights: [
            {
              id: "feed-highlight-detailed",
              summary: "Feed highlight with specifics.",
              specifics: [{ detail: "Feed specific one." }, { detail: "Feed specific two." }],
            },
            {
              id: "feed-highlight-plain",
              summary: "Feed highlight without specifics.",
              specifics: [],
            },
          ],
        },
      ],
      education: [
        {
          institution: null,
          studyType: "Feed Credential",
          area: null,
          endDate: null,
          location: null,
          url: null,
        },
      ],
      certificates: [
        { name: "Feed Numbered Cert", identifier: "4242", url: "https://example.com/cert" },
        { name: "Feed Unnumbered Cert", identifier: null, url: null },
      ],
      skills: [
        {
          name: "Feed Skill Group",
          keywords: [
            { name: "Feed Linked Skill", url: "https://example.com/skill" },
            { name: "Feed Plain Skill", url: null },
          ],
        },
      ],
      projects: [
        { name: null, url: null, description: "Feed unnamed project." },
        {
          name: "Feed Named Project",
          url: "https://example.com/project",
          description: "Feed named project description.",
        },
      ],
    },
  };
}
