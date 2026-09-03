/**
 * The shape of the about-me page's resume content, and the helpers that turn
 * its raw dates into display prose.
 *
 * The data itself lives in ./resume-data.generated.ts, written from the resume
 * microservice's feed by `bun run sync-resume`. The split is what lets a
 * generator rewrite the resume without touching any of the commentary here:
 * these types carry a lot of hard-won reasoning about why fields are shaped
 * the way they are, and regenerating the whole file would erase it every time.
 *
 * The generated module imports these types back, which is a cycle only on
 * paper - a type-only import is erased, so at runtime the dependency points
 * one way, from here to the data.
 */
import {
  certifications,
  contact,
  education,
  jobs,
  personalProjects,
  profile,
  skillGroups,
  summary,
} from "./resume-data.generated";

/**
 * `title` and `tagline` are optional because the feed's schema says they are.
 * JSON Resume requires almost nothing, and the resume microservice is a
 * standalone project that models the schema rather than this page's layout, so
 * every field it marks optional has to be one this page can render without.
 * See remote.ts for where the line between "absent" and "malformed" is drawn.
 */
export type Profile = { name: string; title?: string; tagline?: string };

export type ContactLink = { label: string; url: string };

/**
 * A candidate header location. More than one is listed on purpose: which one
 * belongs on a resume depends on the posting (a remote-first listing and an
 * on-site listing want different answers), so the choice is deferred to
 * whoever is tailoring rather than baked in here.
 */
export type Location = {
  /** Verbatim text for the resume header - not a lookup key. */
  label: string;
  kind: "residence" | "metro" | "remote";
  /** The condition under which this is the right pick. */
  note: string;
};

/**
 * Contact details for a generated resume header. Deliberately not rendered on
 * the about-me page - the site already links out to these in the nav and
 * footer - but carried here because they are part of the resume the
 * microservice serves, and whoever tailors one needs them collected in one
 * place.
 *
 * Email and phone are deliberately absent: the feed this comes from is public
 * and unauthenticated, so a machine-readable address at a predictable URL is a
 * scraping target. The links below are already public profiles and carry no
 * such risk. Whoever generates a resume supplies the direct contact details at
 * that point.
 *
 * Because nothing renders this, remote.ts treats a malformed `contact` as a
 * reason to keep the built-in copy of this section alone rather than to discard
 * the whole live resume.
 */
export type Contact = {
  /** Ordered most-generally-applicable first; exactly one belongs on a resume. */
  locations: Location[];
  links: ContactLink[];
};

/**
 * `level` and `lastUsed` are deliberately absent: the resume microservice's
 * public feed withholds them (a candid self-assessment of an inventory the
 * page publishes in full reads as a disclaimer attached to one's own skill
 * list). They still exist in the private payload used to tailor an actual
 * application; they simply never reach this page.
 */
export type Skill = { name: string; url?: string };
export type SkillGroup = { name: string; skills: Skill[] };

export type Certification = {
  name: string;
  /** Credential ID. Absent for credentials the issuer does not number. */
  id?: string;
  url?: string;
};

export type Role = {
  title: string;
  /** YYYY. Absent for an undated role, which renders as a bare title. */
  start?: string;
  /** YYYY, or null for a role still held. */
  end: string | null;
};
export type RoleLocation = "On-site" | "Hybrid" | "Remote";

/**
 * An agency-staffed period at the start of an engagement, when the legal
 * employer was not the company the work was done for.
 *
 * Recorded because employment verification checks dates against the employer of
 * record: without this, a resume claiming `company` from the job's `start` date
 * disagrees with that company's HR records for the contract window. It sits on
 * the job rather than on a role because the conversion date does not have to
 * line up with a change of title - here it fell in the middle of one.
 */
export type ViaEmployer = {
  /** Legal employer of record for this window. */
  name: string;
  /** YYYY-MM. Matches the job's own start; the engagement began here. */
  start?: string;
  /** YYYY-MM. The date employment converted to `company` directly. */
  end?: string;
  engagement?: "contract-to-hire" | "contract";
};

export type Job = {
  company: string;
  companyUrl?: string;
  companyLocation?: string;
  /** YYYY-MM. The start of the engagement, which may predate direct employment. */
  start?: string;
  /** YYYY-MM, or null for current employment. */
  end: string | null;
  /** Present when the engagement began as an agency contract. */
  viaEmployer?: ViaEmployer;
  description?: string;
  roleLocation?: RoleLocation;
  /**
   * The feed's own headline title, which restates `roles[0].title`. Read only
   * as the fallback in `currentTitleText`: an entry may carry a position
   * without a role history, and then this is the only title there is.
   */
  position?: string;
  /** Most-recent first. May be empty — see `position`. */
  roles: Role[];
  highlights: Highlight[];
};

/**
 * One piece of evidence behind a highlight. An object because the private
 * payload also carries a `tech` list per specific - narrower than the
 * highlight's own - which the public feed withholds; `detail` is what's left
 * once that's stripped.
 */
export type Specific = { detail: string };

/**
 * Everything in this type is published on the about-me page. There is
 * deliberately no field for quantified outcomes, their provenance, or the
 * technology stack behind a bullet: figures and tool names that are not already
 * stated in `summary` or `specifics` are held privately, so nothing here can
 * disclose a former employer's internal scale, spend, headcount, or vendor
 * stack. The resume microservice draws the same line on its public endpoint.
 */
export type Highlight = {
  /**
   * Stable slug, unique across every job. The private skill keys its per-bullet
   * figures and technology lists on this rather than on quoted prose, so
   * rewording a summary can never silently re-point them at the wrong bullet.
   * Change it only if you mean to break that mapping.
   */
  id: string;
  /** Resume-ready prose. The only field the about-me page renders as a bullet. */
  summary: string;
  /**
   * Supporting evidence and context behind `summary` - the detail a one-line
   * bullet has to drop. Expanded in an accordion on the about-me page.
   */
  specifics: Specific[];
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Display prose is derived from start/end rather than stored alongside them,
// so the two can't disagree. A null end means the position is still held.
const PRESENT = "Present";

// The separator between two optional halves of a line. Named because it is
// only ever written where dropping it along with its missing half matters.
const MIDDLE_DOT = "·";

/** "2022-08" -> "August 2022". Falls back to the raw value if it isn't YYYY-MM. */
function monthYearText(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : value;
}

// Every helper below returns "" rather than a partial phrase when the feed did
// not carry what it needs. A date range with one end missing, or a separator
// with nothing on one side of it, reads as a rendering fault; nothing reads as
// a field that was not filled in.

/** Employment dates to the month, e.g. "August 2022 - May 2026". */
export function jobDurationText({ start, end }: Pick<Job, "start" | "end">): string {
  if (!start) return "";
  return `${monthYearText(start)} - ${end === null ? PRESENT : monthYearText(end)}`;
}

/** Role dates to the year, e.g. "2024 - 2026". */
export function roleDurationText({ start, end }: Pick<Role, "start" | "end">): string {
  if (!start) return "";
  return `${start} - ${end ?? PRESENT}`;
}

/** The title currently held: the newest role, or the feed's own `position`
 * for an entry that carries no role history. */
export function currentTitleText({ roles, position }: Pick<Job, "roles" | "position">): string {
  return roles[0]?.title ?? position ?? "";
}

/** What sits after the current title, e.g. "2024 - Present · Remote". */
export function currentRoleText({
  roles,
  roleLocation,
}: Pick<Job, "roles" | "roleLocation">): string {
  const current = roles[0];
  return [current ? roleDurationText(current) : "", roleLocation]
    .filter(Boolean)
    .join(` ${MIDDLE_DOT} `);
}

/** The line under a company name, e.g. "Austin, TX · Payment processing". */
export function companyContextText({
  companyLocation,
  description,
}: Pick<Job, "companyLocation" | "description">): string {
  return [companyLocation, description].filter(Boolean).join(` ${MIDDLE_DOT} `);
}

/**
 * The contract origin of an engagement, e.g.
 * "Contract via Turnberry Solutions, August 2022 - January 2023".
 * Empty string when the job was direct employment throughout.
 */
export function viaEmployerText({ viaEmployer }: Pick<Job, "viaEmployer">): string {
  if (!viaEmployer) return "";
  const { name, start, end } = viaEmployer;
  if (!start || !end) return `Contract via ${name}`;
  return `Contract via ${name}, ${monthYearText(start)} - ${monthYearText(end)}`;
}

// roles are ordered most-recent first; everything after the first entry
// is prior-role history used to generate the "Promoted through" line.
export function promotedThroughText({ roles }: Pick<Job, "roles">): string {
  const priorRoles = roles.slice(1).map((r) => {
    const duration = roleDurationText(r);
    return duration ? `${r.title} (${duration})` : r.title;
  });
  if (priorRoles.length === 0) return "";
  if (priorRoles.length === 1) return `Promoted through ${priorRoles[0]}.`;
  const last = priorRoles.at(-1);
  const rest = priorRoles.slice(0, -1).join(", ");
  return `Promoted through ${rest}, and ${last}.`;
}

export type Education = {
  /** Optional: an equivalency credential like a GED is not issued by a school. */
  institution?: string;
  /** e.g. "B.S.", "Certificate", "Coursework". */
  credential?: string;
  field?: string;
  /** Completion year, YYYY. Omit if not completed. */
  year?: string;
  location?: string;
  url?: string;
};

export type PersonalProject = { name?: string; link?: string; description?: string };

/** Every section of the resume, in one value. */
export type ResumeContent = {
  profile: Profile;
  contact: Contact;
  summary: string;
  skillGroups: SkillGroup[];
  certifications: Certification[];
  jobs: Job[];
  education: Education[];
  personalProjects: PersonalProject[];
};

/**
 * The copy of the resume compiled into the build.
 *
 * The about-me page's live content comes from the resume microservice instead
 * (see ./remote.ts), which is what makes a revision published there show up
 * without a redeploy. This is what the page renders until that lands, what the
 * prerendered HTML contains, and what it keeps if the service is unreachable -
 * so the page is never blank and never blocked on a network round trip.
 *
 * Grouped rather than read field by field so the page has exactly one thing to
 * swap: adding a section to the resume can't leave half the page live and half
 * of it frozen at whatever the last deploy baked in.
 */
export const defaultContent: ResumeContent = {
  profile,
  contact,
  summary,
  skillGroups,
  certifications,
  jobs,
  education,
  personalProjects,
};

// Re-exported so the section names can be imported from here rather than from
// the generated file - callers should not have to know which half of the split
// a given export lives in, and tests that assert against the resume's data go
// on reading it from ./content like they always have.
export {
  certifications,
  contact,
  education,
  jobs,
  personalProjects,
  profile,
  skillGroups,
  summary,
};
