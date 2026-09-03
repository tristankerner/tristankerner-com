/**
 * Turns the `ResumeContent` the about-me page is already displaying into a
 * downloadable `.docx` Blob - entirely client-side, no dependency, no server
 * round trip. Every dimension below reproduces a hand-tuned master resume's
 * formatting exactly; the deliberate content differences from that master
 * (no phone number, a different email, two extra jobs, and so on) are listed
 * in the PR description rather than in code.
 */
import {
  currentRoleText,
  currentTitleText,
  jobDurationText,
  roleDurationText,
  viaEmployerText,
  type ResumeContent,
} from "../content";
import {
  BULLET_NUM_ID,
  COLOR,
  CONTENT_TYPES_XML,
  coreXml,
  documentXml,
  hyperlink,
  NUMBERING_XML,
  PACKAGE_RELS_XML,
  paragraph,
  relationshipsXml,
  RIGHT_TAB,
  run,
  SIZE,
  STYLES_XML,
  tab,
} from "./ooxml";
import { zip, type ZipEntry } from "./zip";

/**
 * The contact address printed in a generated résumé.
 *
 * Deliberately not in the resume feed: that feed is public and
 * unauthenticated, and a machine-readable address at a predictable URL is a
 * scraping target (see the `Contact` type in ./content.ts). This is a
 * disposable alias, so shipping it in the client bundle is an accepted cost -
 * replace it here when it burns out.
 */
export const RESUME_EMAIL = "tk.pub.resume.passerby769@passinbox.com";

const SECTION_HEADINGS = {
  summary: "Summary",
  skills: "Skills",
  certifications: "Certifications",
  workExperience: "Work Experience",
  projects: "Projects",
  education: "Education",
} as const;

function separator() {
  return run("  |  ", { color: COLOR.rule, size: SIZE.small });
}

function sectionHeading(text: string) {
  return paragraph(
    {
      keepNext: true,
      bottomBorder: { size: 6, space: 2, color: COLOR.rule },
      spacing: { before: 230, after: 100 },
    },
    [run(text, { bold: true, caps: true, color: COLOR.heading, size: SIZE.body, spacing: 34 })],
  );
}

/** Strips the scheme and a leading "www." so a URL reads as it does on the page. */
function linkDisplayText(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

/** Joins already-built runs with `separator()` between each. */
function joinWithSeparators(runs: string[]): string[] {
  return runs.flatMap((r, i) => (i === 0 ? [r] : [separator(), r]));
}

/**
 * Builds `word/document.xml` from the résumé content, and returns the
 * hyperlink relationships it referenced (`rId3` onward - `rId1`/`rId2` are
 * reserved for styles.xml and numbering.xml, allocated in `buildResumeDocx`).
 * Split out from `buildResumeDocx` so tests can assert on the XML string
 * directly, without an unzip step.
 */
export function buildDocumentXml(content: ResumeContent): {
  xml: string;
  relationships: { id: string; target: string }[];
} {
  const {
    profile,
    contact,
    summary,
    skillGroups,
    certifications,
    jobs,
    education,
    personalProjects,
  } = content;

  const relationships: { id: string; target: string }[] = [];
  let nextRelId = 3;
  function addHyperlink(target: string): string {
    const id = `rId${nextRelId++}`;
    relationships.push({ id, target });
    return id;
  }

  const residence = contact.locations.find((l) => l.kind === "residence") ?? contact.locations[0];

  const paragraphs: string[] = [];

  // 1. Name
  paragraphs.push(
    paragraph({ align: "center", spacing: { after: 34 } }, [
      run(profile.name.toUpperCase(), {
        bold: true,
        color: COLOR.heading,
        size: SIZE.name,
        spacing: 46,
      }),
    ]),
  );

  // 2. Title line
  paragraphs.push(
    paragraph(
      {
        align: "center",
        bottomBorder: { size: 4, space: 6, color: COLOR.rule },
        spacing: { after: 82 },
      },
      // Kept even when both halves are absent: the paragraph carries the rule
      // under the header, which is layout rather than content.
      [
        run([profile.title, profile.tagline].filter(Boolean).join("  |  "), {
          color: COLOR.body,
          size: SIZE.tagline,
          spacing: 12,
        }),
      ],
    ),
  );

  // 3. Contact line
  const emailRelId = addHyperlink(`mailto:${RESUME_EMAIL}`);
  const emailRun = hyperlink(
    emailRelId,
    run(RESUME_EMAIL, { color: COLOR.heading, size: SIZE.small, underline: true }),
  );
  const contactRuns = residence
    ? [
        run(`Location: ${residence.label}`, { color: COLOR.body, size: SIZE.small }),
        separator(),
        emailRun,
      ]
    : [emailRun];
  paragraphs.push(paragraph({ align: "center", spacing: { before: 60, after: 26 } }, contactRuns));

  // 4. Links line
  const linkRuns = contact.links.map((link) => {
    const relId = addHyperlink(link.url);
    return hyperlink(
      relId,
      run(linkDisplayText(link.url), { color: COLOR.heading, size: SIZE.small, underline: true }),
    );
  });
  paragraphs.push(
    paragraph({ align: "center", spacing: { before: 0, after: 0 } }, joinWithSeparators(linkRuns)),
  );

  // Summary
  paragraphs.push(sectionHeading(SECTION_HEADINGS.summary));
  paragraphs.push(
    paragraph({ spacing: { before: 0, after: 0, line: 235 } }, [
      run(summary, { color: COLOR.body, size: SIZE.body }),
    ]),
  );

  // Skills
  paragraphs.push(sectionHeading(SECTION_HEADINGS.skills));
  for (const group of skillGroups) {
    paragraphs.push(
      paragraph({ spacing: { after: 56, line: 235 }, indentStart: 0 }, [
        run(`${group.name}: `, { bold: true, color: COLOR.body, size: SIZE.body }),
        run(group.skills.map((s) => s.name).join(", "), { color: COLOR.body, size: SIZE.body }),
      ]),
    );
  }

  // Certifications
  paragraphs.push(sectionHeading(SECTION_HEADINGS.certifications));
  paragraphs.push(
    paragraph(
      { spacing: { after: 40, line: 235 } },
      joinWithSeparators(
        certifications.map((cert) =>
          run(cert.name, { bold: true, color: COLOR.body, size: SIZE.body }),
        ),
      ),
    ),
  );

  // Work Experience
  paragraphs.push(sectionHeading(SECTION_HEADINGS.workExperience));
  for (const job of jobs) {
    // 9. Job company line
    paragraphs.push(
      paragraph({ keepNext: true, rightTabAt: RIGHT_TAB, spacing: { before: 130, after: 0 } }, [
        run(job.company, { bold: true, color: COLOR.heading, size: SIZE.company }),
        run(job.companyLocation ? `   ${job.companyLocation}` : "", {
          color: COLOR.muted,
          size: SIZE.small,
        }),
        tab(),
        run(jobDurationText(job), { bold: true, color: COLOR.muted, size: SIZE.small }),
      ]),
    );

    // 10. Job description
    if (job.description) {
      paragraphs.push(
        paragraph({ keepNext: true, spacing: { before: 18, after: 0 } }, [
          run(job.description, { italic: true, color: COLOR.muted, size: SIZE.small }),
        ]),
      );
    }

    // 11. Current role
    const currentTitle = currentTitleText(job);
    const currentRole = currentRoleText(job);
    if (currentTitle || currentRole) {
      paragraphs.push(
        paragraph({ keepNext: true, rightTabAt: RIGHT_TAB, spacing: { before: 76, after: 0 } }, [
          run(currentTitle, { bold: true, color: COLOR.body, size: SIZE.body }),
          tab(),
          run(currentRole, { color: COLOR.muted, size: SIZE.small }),
        ]),
      );
    }

    // 12. Promoted through
    if (job.roles.length > 1) {
      const priorRoles = job.roles
        .slice(1)
        .map((role) => {
          const duration = roleDurationText(role);
          return duration ? `${role.title} (${duration})` : role.title;
        })
        .join("  ·  ");
      paragraphs.push(
        paragraph({ keepNext: true, spacing: { before: 14, after: 74 } }, [
          run("Promoted through: ", { bold: true, color: COLOR.muted, size: SIZE.small }),
          run(priorRoles, { color: COLOR.muted, size: SIZE.small }),
        ]),
      );
    }

    // 13. Contract origin
    if (job.viaEmployer) {
      paragraphs.push(
        paragraph({ keepNext: true, spacing: { before: 0, after: 74 } }, [
          run(viaEmployerText(job), { italic: true, color: COLOR.muted, size: SIZE.small }),
        ]),
      );
    }

    // 14. Highlight bullets - highlight.specifics is never emitted.
    for (const highlight of job.highlights) {
      paragraphs.push(
        paragraph(
          { style: "ListParagraph", numId: BULLET_NUM_ID, spacing: { after: 54, line: 238 } },
          [run(highlight.summary, { color: COLOR.body, size: SIZE.body })],
        ),
      );
    }
  }

  // Projects
  paragraphs.push(sectionHeading(SECTION_HEADINGS.projects));
  for (const project of personalProjects) {
    const runs: string[] = [];
    if (project.name) {
      runs.push(run(`${project.name}: `, { bold: true, color: COLOR.body, size: SIZE.body }));
    }
    if (project.description) {
      runs.push(run(project.description, { color: COLOR.body, size: SIZE.body }));
    }
    // An entry with neither would be a bullet with nothing beside it.
    if (runs.length === 0) continue;
    paragraphs.push(
      paragraph(
        { style: "ListParagraph", numId: BULLET_NUM_ID, spacing: { after: 54, line: 238 } },
        runs,
      ),
    );
  }

  // Education
  paragraphs.push(sectionHeading(SECTION_HEADINGS.education));
  for (const edu of education) {
    const parts = [
      [edu.credential, edu.field].filter(Boolean).join(", "),
      edu.institution,
      edu.location,
      edu.year,
    ].filter((part): part is string => Boolean(part));
    paragraphs.push(
      paragraph({ spacing: { before: 0, after: 0 } }, [
        run(parts.join(" · "), { color: COLOR.body, size: SIZE.body }),
      ]),
    );
  }

  return { xml: documentXml(paragraphs.join("")), relationships };
}

const HYPERLINK_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

/** Assembles the full `.docx` package as a Blob ready to download. */
export function buildResumeDocx(content: ResumeContent): Blob {
  const { xml: documentXmlContent, relationships } = buildDocumentXml(content);

  const documentRelsXml = relationshipsXml([
    {
      id: "rId1",
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles",
      target: "styles.xml",
    },
    {
      id: "rId2",
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering",
      target: "numbering.xml",
    },
    ...relationships.map((r) => ({
      id: r.id,
      type: HYPERLINK_REL_TYPE,
      target: r.target,
      targetMode: "External" as const,
    })),
  ]);

  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    { path: "[Content_Types].xml", data: encoder.encode(CONTENT_TYPES_XML) },
    { path: "_rels/.rels", data: encoder.encode(PACKAGE_RELS_XML) },
    { path: "word/document.xml", data: encoder.encode(documentXmlContent) },
    { path: "word/_rels/document.xml.rels", data: encoder.encode(documentRelsXml) },
    { path: "word/styles.xml", data: encoder.encode(STYLES_XML) },
    { path: "word/numbering.xml", data: encoder.encode(NUMBERING_XML) },
    { path: "docProps/core.xml", data: encoder.encode(coreXml(content.profile.name)) },
  ];

  return new Blob([zip(entries)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * `${profile.name} - Master Resume - YYYY-MM-DD.docx`. `now` is injectable
 * so tests don't depend on the clock; UTC fields keep the date stable
 * regardless of the caller's time zone.
 */
export function resumeFileName(content: ResumeContent, now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const name = `${content.profile.name} - Master Resume - ${year}-${month}-${day}.docx`;
  // eslint-disable-next-line no-control-regex -- deliberately stripping control characters
  return name.replace(/[/\\\x00-\x1f]/g, "");
}
