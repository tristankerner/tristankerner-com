import { describe, expect, it } from "vitest";
import { GENERATED_PATH, renderResumeData } from "./render-resume-data";
import { feedPayload } from "../src/routes/about-me/feed.fixture";
import { toResumeContent } from "../src/routes/about-me/remote";
import { defaultContent } from "../src/routes/about-me/content";

function render() {
  const content = toResumeContent(feedPayload());
  if (!content) throw new Error("expected the fixture feed to read cleanly");
  return renderResumeData(content);
}

describe("renderResumeData", () => {
  it("warns that the file is generated and says how to change it", () => {
    const out = render();

    expect(out).toContain("GENERATED FILE - do not edit by hand.");
    expect(out).toContain("bun run sync-resume");
  });

  it("declares every section with its type", () => {
    const out = render();

    for (const [name, type] of [
      ["profile", "Profile"],
      ["contact", "Contact"],
      ["summary", "string"],
      ["skillGroups", "SkillGroup[]"],
      ["certifications", "Certification[]"],
      ["jobs", "Job[]"],
      ["education", "Education[]"],
      ["personalProjects", "PersonalProject[]"],
    ]) {
      expect(out).toContain(`export const ${name}: ${type} =`);
    }
  });

  it("imports the types it annotates with, and nothing for the plain string", () => {
    const out = render();
    const [, imported] = /import type \{ (.+) \} from "\.\/content";/.exec(out) ?? [];

    expect(imported?.split(", ")).toEqual([
      "Certification",
      "Contact",
      "Education",
      "Job",
      "PersonalProject",
      "Profile",
      "SkillGroup",
    ]);
  });

  // content.ts spells an absent optional as a missing key, so an explicit
  // `undefined` would be noise in a file that gets committed.
  it("omits absent optional fields entirely", () => {
    const out = render();

    expect(out).not.toContain("undefined");
    // The fixture's second certification has no id and no url.
    expect(out).toContain('"name": "Feed Unnumbered Cert"');
  });

  // A null end date means "still current" - dropping it would silently turn a
  // finished role into an ongoing one.
  it("keeps a null end date", () => {
    expect(render()).toContain('"end": null');
  });

  it("round-trips the real committed content unchanged", async () => {
    // The strongest check available without a network call: rendering what the
    // repo currently ships must reproduce the file the repo currently has.
    const onDisk = await import("../src/routes/about-me/resume-data.generated");
    const rendered = renderResumeData(defaultContent);

    expect(rendered).toContain(JSON.stringify(onDisk.profile.name));
    expect(rendered).toContain(JSON.stringify(onDisk.jobs[0].company));
  });

  it("points at the file it generates", () => {
    expect(GENERATED_PATH).toBe("src/routes/about-me/resume-data.generated.ts");
  });
});
