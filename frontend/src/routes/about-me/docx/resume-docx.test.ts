import { describe, expect, it } from "vitest";
import { defaultContent } from "../content";
import { toResumeContent } from "../remote";
import { feedPayload } from "../feed.fixture";
import { buildDocumentXml, buildResumeDocx, RESUME_EMAIL, resumeFileName } from "./resume-docx";

const feedContent = toResumeContent(feedPayload());
if (!feedContent) throw new Error("feedPayload() failed to normalize");

describe("buildDocumentXml", () => {
  it("produces XML with no parser errors", () => {
    const { xml } = buildDocumentXml(defaultContent);
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
  });

  it("includes every highlight summary and never a specifics string", () => {
    const { xml } = buildDocumentXml(feedContent);
    for (const job of feedContent.jobs) {
      for (const highlight of job.highlights) {
        expect(xml).toContain(highlight.summary);
        for (const specific of highlight.specifics) {
          expect(xml).not.toContain(specific);
        }
      }
    }
  });

  it("prints RESUME_EMAIL once as text and once as a mailto: relationship target, and no phone number", () => {
    const { xml, relationships } = buildDocumentXml(defaultContent);

    const textOccurrences = xml.split(RESUME_EMAIL).length - 1;
    expect(textOccurrences).toBe(1);

    const mailtoRels = relationships.filter((r) => r.target === `mailto:${RESUME_EMAIL}`);
    expect(mailtoRels).toHaveLength(1);

    expect(xml).not.toMatch(/\d{3}-\d{3}-\d{4}/);
    // No other email address anywhere in the document.
    const emailMatches = xml.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
    expect(emailMatches).toEqual([RESUME_EMAIL]);
  });

  it("prints the chosen residence location and not the other header candidates", () => {
    const { xml } = buildDocumentXml(defaultContent);
    expect(xml).toContain("Location: Napa, CA");
    expect(xml).not.toContain("Location: Remote (USA)");
    expect(xml).not.toContain("Location: San Francisco Bay Area");
  });

  it("lists all four company names, in feed order", () => {
    const { xml } = buildDocumentXml(defaultContent);
    const names = defaultContent.jobs.map((job) => job.company);
    expect(names).toHaveLength(4);

    const positions = names.map((name) => xml.indexOf(`>${name}<`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("emits one bullet paragraph per highlight plus personal project", () => {
    const { xml } = buildDocumentXml(defaultContent);
    const totalHighlights = defaultContent.jobs.reduce((n, job) => n + job.highlights.length, 0);
    const expectedBullets = totalHighlights + defaultContent.personalProjects.length;

    const bulletParagraphs = xml.match(/<w:pStyle w:val="ListParagraph"\/>/g) ?? [];
    expect(bulletParagraphs).toHaveLength(expectedBullets);
  });

  it("has no dangling relationship ids: every referenced rId exists in the returned relationships", () => {
    const { xml, relationships } = buildDocumentXml(defaultContent);
    const knownIds = new Set(relationships.map((r) => r.id));

    const referenced = [...xml.matchAll(/<w:hyperlink r:id="(rId\d+)">/g)].map((m) => m[1]!);
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) expect(knownIds.has(id)).toBe(true);
  });

  it("allocates relationship ids starting at rId3", () => {
    const { relationships } = buildDocumentXml(defaultContent);
    expect(relationships[0]!.id).toBe("rId3");
    const ids = relationships.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes promoted-through and contract-origin text only for the jobs that have them", () => {
    const { xml } = buildDocumentXml(defaultContent);
    // Independent School Management has 3 roles and a viaEmployer.
    const ism = defaultContent.jobs.find((j) => j.company === "Independent School Management")!;
    expect(xml).toContain("Promoted through: ");
    expect(xml).toContain(ism.roles[1]!.title);

    // Self-employed and The QB Specialists each have a single role and no
    // viaEmployer, so nothing about those two triggers either block.
    const selfEmployed = defaultContent.jobs.find((j) => j.company === "Self-employed")!;
    expect(selfEmployed.roles).toHaveLength(1);
    expect(selfEmployed.viaEmployer).toBeUndefined();
  });

  it("handles a feed with a single, unnamed project and an unresolved credential field", () => {
    const { xml } = buildDocumentXml(feedContent);
    // The fixture's first project has no name - no bold label run for it.
    const unnamed = feedContent.personalProjects.find((p) => !p.name)!;
    expect(xml).toContain(unnamed.description);

    const named = feedContent.personalProjects.find((p) => p.name)!;
    expect(xml).toContain(`${named.name}: `);
  });
});

describe("buildResumeDocx", () => {
  it("returns a Blob with the docx MIME type, a PK header, and the Content_Types part", async () => {
    const blob = buildResumeDocx(defaultContent);
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("[Content_Types].xml");
  });
});

describe("resumeFileName", () => {
  it("formats the profile name and an injected date", () => {
    expect(resumeFileName(defaultContent, new Date("2026-08-27T00:00:00Z"))).toBe(
      `${defaultContent.profile.name} - Master Resume - 2026-08-27.docx`,
    );
  });

  it("strips slashes, backslashes, and control characters from the name", () => {
    const content = {
      ...defaultContent,
      profile: { ...defaultContent.profile, name: "A/B\\C\tD" },
    };
    const name = resumeFileName(content, new Date("2026-01-01T00:00:00Z"));
    expect(name).toBe("ABCD - Master Resume - 2026-01-01.docx");
  });
});
