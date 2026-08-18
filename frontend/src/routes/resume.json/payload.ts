import {
  certifications,
  contact,
  education,
  jobDurationText,
  jobs,
  personalProjects,
  profile,
  roleDurationText,
  skillGroups,
  summary,
} from "../about-me/content";
import { FEED_URL, HUMAN_URL, README, SCHEMA_URL, SCHEMA_VERSION } from "./schema";

/**
 * The master resume data as a machine-readable payload, for generating resumes
 * tailored to a specific job description.
 *
 * Shares its source of truth with the about-me page, and is deliberately a
 * near-mirror of it: the only additions are shape rather than substance -
 * per-highlight `tech`, machine-readable dates, and the header links. Nothing
 * here is unpublished, because the page publishes all of it too.
 *
 * What is NOT here is the point: quantified outcomes, their provenance, and the
 * first-person narrative used for cover letters all live in the private
 * fine-tune-resume skill instead. That keeps a former employer's internal
 * scale, spend, and headcount - and Tristan's own job-search positioning - out
 * of a document anyone can fetch. See ./schema.ts for how the feed states this
 * to its consumers, and server.test.ts for the guard that keeps it true.
 *
 * Lives here rather than in +server.ts because SvelteKit only permits a fixed
 * set of exports from a route module.
 */
export const buildResume = () => ({
  $schema: SCHEMA_URL,
  meta: {
    version: SCHEMA_VERSION,
    // Build date, so a consumer can tell how fresh the data is. Prerendering
    // means this is stamped once per deploy rather than per request.
    generated: new Date().toISOString().slice(0, 10),
    canonical: FEED_URL,
    humanPage: HUMAN_URL,
    readme: README,
  },
  basics: {
    name: profile.name,
    title: profile.title,
    tagline: profile.tagline,
    locations: contact.locations,
    links: contact.links,
  },
  summary,
  skillGroups,
  certifications,
  // Named `work` rather than `jobs` to match the field name every other resume
  // schema uses, so a consumer's prior expectations line up.
  //
  // `duration` is derived here rather than stored in content.ts, so it can never
  // drift from start/end. It ships anyway because a consumer writing a resume
  // wants the display string, not a date-formatting chore.
  work: jobs.map((job) => ({
    ...job,
    duration: jobDurationText(job),
    roles: job.roles.map((role) => ({ ...role, duration: roleDurationText(role) })),
  })),
  education,
  personalProjects,
});
