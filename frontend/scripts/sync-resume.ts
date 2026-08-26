#!/usr/bin/env bun
// Rewrites src/routes/about-me/resume-data.generated.ts from the resume
// microservice's public feed.
//
// Usage:
//   bun run sync-resume                 # fetch, validate, write
//   bun run sync-resume -- --check      # report whether it is stale; write nothing
//   bun run sync-resume -- --url <url>  # read a different service (staging, a local copy)
//
// Why this exists at all: /about-me fetches the feed in the browser, but the
// *prerendered* HTML is built from resume-data.generated.ts. That HTML is what
// search engines index and what a visitor without JavaScript reads, so leaving
// it frozen at whenever the file was last hand-edited means the indexed resume
// slowly drifts from the real one. Running this before a production build keeps
// the two in step (see .github/workflows/deploy.yml).
//
// It reuses remote.ts's readers rather than parsing the feed again, so what
// gets committed here and what a browser renders have passed exactly the same
// validation - including the http(s)-only URL filter.
//
// Exit codes are chosen for that CI use:
//   0  wrote the file, or it was already current, or the feed was unreachable
//   1  the feed answered but could not be read, or a bad argument
//
// An unreachable feed is deliberately not a failure: a deploy should not be
// blocked by someone else's outage when a perfectly good committed copy is
// sitting right there. A feed that *is* reachable and malformed is a real
// problem, and shipping stale content while staying quiet about it would hide
// it.

import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RESUME_FEED_URL, fetchFeed, toResumeContent } from "../src/routes/about-me/remote";
import { GENERATED_PATH, renderResumeData } from "./render-resume-data";

const FRONTEND_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(FRONTEND_DIR, GENERATED_PATH);

export function printUsage(): void {
  console.log("Usage: bun run sync-resume [-- --check] [-- --url <feed url>]");
}

/**
 * Runs `oxfmt` over the written file.
 *
 * `renderResumeData` emits `JSON.stringify` output - quoted keys, one item per
 * line - which is valid TypeScript but not what the rest of the repo looks
 * like. Formatting here rather than asking whoever ran this to remember `bun
 * run fmt` is what keeps `bun run fmt:check` green in CI.
 *
 * A missing binary is a warning, not a failure: the file is already correct,
 * just ugly.
 */
export function formatGenerated(target: string = TARGET): boolean {
  const oxfmt = join(FRONTEND_DIR, "node_modules", ".bin", "oxfmt");
  if (!existsSync(oxfmt)) {
    console.warn("oxfmt not found; wrote the file unformatted. Run `bun run fmt`.");
    return false;
  }
  const { status } = spawnSync(oxfmt, [target], { stdio: "inherit" });
  if (status !== 0) console.warn("oxfmt exited non-zero; run `bun run fmt` to check.");
  return status === 0;
}

export type SyncResult =
  | { outcome: "written"; changed: boolean }
  | { outcome: "stale"; changed: true }
  | { outcome: "current"; changed: false }
  | { outcome: "unreachable"; changed: false }
  | { outcome: "unreadable"; changed: false };

/**
 * Fetches, validates, and (unless `check`) writes the generated module.
 *
 * Takes its dependencies as arguments so tests can drive every outcome without
 * a network call or a write to the real source tree.
 */
export async function syncResume(options: {
  url?: string;
  check?: boolean;
  target?: string;
  fetchImpl?: typeof fetch;
  format?: (target: string) => unknown;
}): Promise<SyncResult> {
  const {
    url = RESUME_FEED_URL,
    check = false,
    target = TARGET,
    fetchImpl = fetch,
    format = formatGenerated,
  } = options;

  const payload = await fetchFeed(fetchImpl, url);
  if (payload === null) return { outcome: "unreachable", changed: false };

  const content = toResumeContent(payload);
  if (content === null) return { outcome: "unreadable", changed: false };

  const next = renderResumeData(content);
  // Compared as text rather than by re-parsing, so a change in how the file is
  // rendered counts as a change too - otherwise `--check` would pass while the
  // committed file no longer matched what this script produces.
  const previous = existsSync(target) ? await readFile(target, "utf-8") : null;

  if (check) {
    return previous === next
      ? { outcome: "current", changed: false }
      : { outcome: "stale", changed: true };
  }

  if (previous === next) return { outcome: "current", changed: false };

  await writeFile(target, next, "utf-8");
  format(target);
  return { outcome: "written", changed: true };
}

/** `sync` is injectable so tests can exercise the exit codes without a write. */
export async function main(
  argv: string[] = process.argv.slice(2),
  sync: typeof syncResume = syncResume,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: { check: { type: "boolean" }, url: { type: "string" }, help: { type: "boolean" } },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    printUsage();
    return 1;
  }

  if (parsed.values.help) {
    printUsage();
    return 0;
  }

  const result = await sync({ url: parsed.values.url, check: parsed.values.check });

  switch (result.outcome) {
    case "written":
      console.log(`Updated ${GENERATED_PATH} from the resume feed.`);
      return 0;
    case "current":
      console.log(`${GENERATED_PATH} is already current.`);
      return 0;
    case "stale":
      console.error(
        `${GENERATED_PATH} is out of date. Run \`bun run sync-resume\` and commit the result.`,
      );
      return 1;
    case "unreachable":
      // Warning, not an error - see the exit-code note at the top.
      console.warn(`Could not reach the resume feed; keeping the committed ${GENERATED_PATH}.`);
      return 0;
    case "unreadable":
      console.error("The resume feed answered but could not be read; see the warning above.");
      return 1;
  }
}

// Guarded so importing this module's helpers for tests doesn't also run the
// CLI against the test runner's own argv. import.meta.main is never true
// under the test runner, so this block is unreachable from tests by design.
/* v8 ignore start */
if (import.meta.main) {
  main().then((code) => process.exit(code));
}
/* v8 ignore stop */
