/**
 * A complete, valid response from the resume microservice, for tests that need
 * one.
 *
 * Every value is deliberately unlike the content compiled into the build, so an
 * assertion that finds it has necessarily found live data rather than the
 * defaults the page starts with. The shape - snake_case fields, a revision
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
      profile: {
        name: "Feed Profile Name",
        title: "Feed Profile Title",
        tagline: "Feed Profile Tagline",
      },
      contact: {
        locations: [{ label: "Feed Location", kind: "remote", note: "Feed location note." }],
        links: [{ label: "Website", url: "https://example.com/feed" }],
      },
      summary: "Feed summary paragraph.",
      skill_groups: [
        {
          name: "Feed Skill Group",
          skills: [
            { name: "Feed Linked Skill", url: "https://example.com/skill" },
            { name: "Feed Plain Skill", url: null },
          ],
        },
      ],
      certifications: [
        { name: "Feed Numbered Cert", id: "4242", url: "https://example.com/cert" },
        { name: "Feed Unnumbered Cert", id: null, url: null },
      ],
      jobs: [
        {
          company: "Feed Current Company",
          company_url: "https://example.com/company",
          company_location: "Feed City, ST",
          start: "2022-08",
          end: null,
          via_employer: {
            name: "Feed Staffing Agency",
            start: "2022-08",
            end: "2023-01",
            engagement: "contract-to-hire",
          },
          description: "Feed company description.",
          role_location: "Remote",
          roles: [
            { title: "Feed Senior Role", start: "2024", end: null },
            { title: "Feed Junior Role", start: "2022", end: "2024" },
          ],
          highlights: [
            {
              id: "feed-highlight-detailed",
              summary: "Feed highlight with specifics.",
              specifics: ["Feed specific one.", "Feed specific two."],
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
          credential: "Feed Credential",
          field: null,
          year: null,
          location: null,
          url: null,
        },
      ],
      personal_projects: [
        { name: null, link: null, description: "Feed unnamed project." },
        {
          name: "Feed Named Project",
          link: "https://example.com/project",
          description: "Feed named project description.",
        },
      ],
    },
  };
}
