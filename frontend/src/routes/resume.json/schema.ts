import { SITE_URL } from "$lib/blog/config";

// Bumped when the payload shape changes in a way a consumer could notice:
// a renamed or removed field, or a changed meaning. Adding an optional field
// is a minor bump; adding documentation alone is a patch.
export const SCHEMA_VERSION = "1.0.0";

export const SCHEMA_URL = `${SITE_URL}/resume.schema.json`;
export const FEED_URL = `${SITE_URL}/resume.json`;
export const HUMAN_URL = `${SITE_URL}/about-me`;

/**
 * Instructions that travel with the data. JSON has no comments, so the prose
 * that tells a consumer how to *use* these fields - as opposed to what type
 * they are, which the schema covers - rides along in the payload itself and
 * survives being copied, pasted, or fetched out of context.
 */
export const README = [
  "This is Tristan Kerner's resume data, published so a tailored resume can be assembled from",
  "evidence rather than guesswork. Everything here is public: it mirrors what is already on the",
  "human-readable page, in a shape that is easier to select from.",
  "",
  "It is deliberately NOT the complete picture. Quantified outcomes, the reasoning behind each",
  "figure, and first-person material for cover letters are held privately and are not served",
  "here, because this document is public and those details are not. If you are working from a",
  "private skill or attachment that supplies them, use that as the source for numbers and voice",
  "and this feed as the source for structure. If you are not, ask - never estimate a figure and",
  "never invent a motivation to fill the gap.",
  "",
  "How to use it:",
  "- `work[].highlights[].summary` is resume-ready prose. Use it close to verbatim.",
  "- `work[].highlights[].specifics` is supporting evidence and context, NOT bullet text. Use it",
  "  to judge relevance and to substantiate a claim. Compress it into a summary; never paste it",
  "  in as a bullet.",
  "- Technology keywords are not in this feed. `skillGroups` is the public skill inventory; which",
  "  specific tools belong to which bullet is held privately. Take per-bullet technologies from",
  "  the private source, matched on `work[].highlights[].id`, and never infer them - attributing a",
  "  tool to the wrong employer or project is worse than omitting it.",
  "- Figures appear here only where they are already part of a `summary` or `specifics` sentence.",
  "  There is no separate metrics field, and there never will be. Any other number - headcounts,",
  "  customer counts, budgets, internal volumes - is withheld on purpose. Take numbers from the",
  "  private source if you have one, and otherwise ask; never derive, extrapolate, or estimate a",
  "  figure from what is here.",
  "- `skillGroups[].skills[].level` and `.lastUsed` are selection aids and are never printed. A",
  "  two-page resume fits a fraction of this skill list: prefer `expert` and `working`, and only",
  "  list a `familiar` skill if the posting names it directly. Absent means unrated, not expert.",
  "  Treat a stale `lastUsed` as a reason to leave a skill off when the posting wants it current.",
  "- There is no first-person or cover-letter material in this feed. Motivation, working style,",
  "  and voice are held privately. Draw on the private source for those if you have one; if you",
  "  do not, ask rather than inventing a reason for applying or a preference he has not stated.",
  "- `start`/`end` are the source of truth for dates (`end: null` means still current); `duration`",
  "  is display prose derived from them. Print `duration`; use `start`/`end` to sort or reformat.",
  "- `basics.locations` is a list of candidate header locations, not a history. Pick exactly one",
  "  using each entry's `note`, and put only that one on the resume.",
  "- A job with `viaEmployer` began as an agency contract before converting to direct employment.",
  "  By default keep it as one continuous entry and note the origin under the company, e.g.",
  '  "Contract via Turnberry Solutions, August 2022 - January 2023" - the continuity is the point.',
  "  But if the posting or form asks for complete or verified employment history, split it into a",
  "  separate employer entry using those exact dates instead. Never drop it: the company's own HR",
  "  records start at the conversion date, and employment verification will compare them.",
  "- There is no email or phone number in this feed, on purpose - it is public, and a",
  "  machine-readable address here would just be scraped. Ask for both and wait for an answer",
  "  before producing a document. Never guess them, and never substitute a link for them.",
  "- `education` and `certifications` are complete and verifiable. List them as given. Never add",
  "  an entry, and never upgrade one - an equivalency credential is not a degree.",
  "- Omit aggressively. A tailored two-page resume should draw on roughly a third of this file.",
  "",
  `The human-readable version of this data is at ${HUMAN_URL}.`,
].join("\n");

export type SchemaNode = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: string[];
  enum?: string[];
  format?: string;
};

const contactLink: SchemaNode = {
  type: "object",
  description: "An external profile or site to list in the resume header.",
  required: ["label", "url"],
  properties: {
    label: { type: "string", description: 'Display name for the link, e.g. "LinkedIn".' },
    url: { type: "string", format: "uri", description: "Absolute URL." },
  },
};

const location: SchemaNode = {
  type: "object",
  description:
    "A candidate header location. The list is a menu, not a history - choose one per resume.",
  required: ["label", "kind", "note"],
  properties: {
    label: {
      type: "string",
      description: "Verbatim text for the resume header. Not a lookup key.",
    },
    kind: {
      type: "string",
      enum: ["residence", "metro", "remote"],
      description:
        "residence: an actual address city. metro: a broader commutable area. remote: no geography claimed.",
    },
    note: {
      type: "string",
      description: "The condition under which this entry is the right pick for a given posting.",
    },
  },
};

const skill: SchemaNode = {
  type: "object",
  description: "A single named skill, optionally linked to its canonical reference.",
  required: ["name"],
  properties: {
    name: { type: "string", description: "The skill as it should be written on a resume." },
    url: { type: "string", format: "uri", description: "Reference link. Never resume output." },
    level: {
      type: "string",
      enum: ["expert", "working", "familiar"],
      description:
        "Self-rated depth. Absent means unrated - treat as unknown, not as expert. Never print this; use it to choose which skills make the cut.",
    },
    lastUsed: {
      type: "string",
      description:
        "YYYY, the last year the skill was used in earnest. Absent means unrecorded. Never print this; use it to judge currency against the posting.",
    },
  },
};

const highlight: SchemaNode = {
  type: "object",
  description:
    "One accomplishment, as prose only. There is no metrics field and no technology field, by design: figures and tool names not already stated in summary or specifics are withheld from this public feed.",
  required: ["id", "summary", "specifics"],
  properties: {
    id: {
      type: "string",
      description:
        "Stable identifier, unique across every job. A private source of per-bullet figures and technologies keys on this; match on it rather than on summary text, which can be reworded.",
    },
    summary: {
      type: "string",
      description: "Resume-ready bullet prose. The only field intended for near-verbatim output.",
    },
    specifics: {
      type: "array",
      description:
        "Supporting detail a one-line bullet has to drop. Use to judge relevance and substantiate claims; compress before using, never paste verbatim.",
      items: { type: "string", description: "One piece of supporting detail." },
    },
  },
};

const role: SchemaNode = {
  type: "object",
  description: "A titled position within a job, most recent first.",
  required: ["title", "start", "end", "duration"],
  properties: {
    title: { type: "string", description: "Job title as held." },
    start: { type: "string", description: "Start year, YYYY." },
    end: { type: ["string", "null"], description: "End year, YYYY. null means still held." },
    duration: {
      type: "string",
      description: 'Display prose derived from start/end, e.g. "2024 - 2026".',
    },
  },
};

const work: SchemaNode = {
  type: "object",
  description: "One employer. Ordered most recent first.",
  required: [
    "company",
    "companyLocation",
    "duration",
    "start",
    "end",
    "description",
    "roleLocation",
    "roles",
    "highlights",
  ],
  properties: {
    company: { type: "string", description: "Employer name." },
    companyUrl: { type: "string", format: "uri", description: "Employer website." },
    companyLocation: {
      type: "string",
      description: "Where the employer is based - not necessarily where the work happened.",
    },
    start: {
      type: "string",
      description:
        "Start of the engagement, YYYY-MM. When viaEmployer is present this predates direct employment by the company.",
    },
    end: {
      type: ["string", "null"],
      description: "End of employment, YYYY-MM. null means current.",
    },
    viaEmployer: {
      type: "object",
      description:
        "Present when the engagement began as an agency contract before converting to direct employment. See the readme for how to render it.",
      required: ["name", "start", "end", "engagement"],
      properties: {
        name: {
          type: "string",
          description: "Legal employer of record during the contract window.",
        },
        start: { type: "string", description: "Start of the contract window, YYYY-MM." },
        end: { type: "string", description: "Conversion to direct employment, YYYY-MM." },
        engagement: {
          type: "string",
          enum: ["contract-to-hire", "contract"],
          description: "The nature of the agency engagement.",
        },
      },
    },
    duration: {
      type: "string",
      description: 'Display prose derived from start/end, e.g. "August 2022 - May 2026".',
    },
    description: {
      type: "string",
      description: "What the employer does. Context for the reader; usually one line on a resume.",
    },
    roleLocation: {
      type: "string",
      enum: ["On-site", "Hybrid", "Remote"],
      description: "How the work was actually performed.",
    },
    roles: {
      type: "array",
      description:
        "Titles held at this employer, most recent first. More than one entry indicates promotion.",
      items: role,
    },
    highlights: {
      type: "array",
      description: "Accomplishments at this employer.",
      items: highlight,
    },
  },
};

export const resumeSchema: SchemaNode = {
  type: "object",
  description: README,
  required: ["meta", "basics", "summary", "skillGroups", "certifications", "work", "education"],
  properties: {
    $schema: { type: "string", format: "uri", description: "URL of this schema." },
    meta: {
      type: "object",
      description: "Provenance and usage instructions for the payload.",
      required: ["version", "generated", "canonical", "humanPage", "readme"],
      properties: {
        version: { type: "string", description: "Semantic version of the payload shape." },
        generated: { type: "string", description: "Build date of this document, YYYY-MM-DD." },
        canonical: { type: "string", format: "uri", description: "Canonical URL of this feed." },
        humanPage: { type: "string", format: "uri", description: "Human-readable equivalent." },
        readme: {
          type: "string",
          description: "How to use this data. Read before generating anything from it.",
        },
      },
    },
    basics: {
      type: "object",
      description:
        "Identity and public profile links for a resume header. Email and phone are deliberately absent from this feed - they must be supplied by whoever generates the resume.",
      required: ["name", "title", "tagline", "locations", "links"],
      properties: {
        name: { type: "string", description: "Full name." },
        title: {
          type: "string",
          description:
            "Current self-described title. Replace with the target job's title when tailoring.",
        },
        tagline: { type: "string", description: "Short specialism line." },
        locations: {
          type: "array",
          description: "Candidate header locations. Choose exactly one.",
          items: location,
        },
        links: { type: "array", description: "Profile links for the header.", items: contactLink },
      },
    },
    summary: {
      type: "string",
      description:
        "Professional summary in full. Expected to be rewritten and shortened for each application.",
    },
    skillGroups: {
      type: "array",
      description:
        "The full skill inventory, grouped by category. A tailored resume lists a subset.",
      items: {
        type: "object",
        description: "One named category of skills.",
        required: ["name", "skills"],
        properties: {
          name: { type: "string", description: "Category name." },
          skills: { type: "array", description: "Skills in this category.", items: skill },
        },
      },
    },
    certifications: {
      type: "array",
      description: "Earned certifications. These are verifiable - never add to this list.",
      items: {
        type: "object",
        description: "One earned, verifiable certification.",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Certification name as issued." },
          id: {
            type: "string",
            description: "Credential ID. Absent for credentials the issuer does not number.",
          },
          url: { type: "string", format: "uri", description: "Issuer's credential page." },
        },
      },
    },
    work: { type: "array", description: "Employment history, most recent first.", items: work },
    education: {
      type: "array",
      description:
        "Formal education, in full. This list is complete and verifiable - list it as-is, and never add to, upgrade, or embellish an entry.",
      items: {
        type: "object",
        description: "One completed or in-progress course of study.",
        required: ["credential"],
        properties: {
          institution: {
            type: "string",
            description:
              "School name. Absent for an equivalency credential, which is not issued by a school.",
          },
          credential: { type: "string", description: 'e.g. "B.S.", "Certificate", "Coursework".' },
          field: { type: "string", description: "Field of study." },
          year: { type: "string", description: "Completion year, YYYY." },
          location: { type: "string", description: "City, state." },
          url: { type: "string", format: "uri", description: "School website." },
        },
      },
    },
    personalProjects: {
      type: "array",
      description: "Side projects. Usually the first section to cut for space.",
      items: {
        type: "object",
        description: "One personal project.",
        required: ["description"],
        properties: {
          name: { type: "string", description: "Project name, if it has one." },
          link: { type: "string", format: "uri", description: "Project URL." },
          description: { type: "string", description: "What it is and what it was built with." },
        },
      },
    },
  },
};
