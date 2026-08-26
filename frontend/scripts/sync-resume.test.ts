import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatGenerated, main, printUsage, syncResume } from "./sync-resume";
import { renderResumeData } from "./render-resume-data";
import { feedPayload } from "../src/routes/about-me/feed.fixture";
import { toResumeContent } from "../src/routes/about-me/remote";

let dir: string;
let target: string;

/** Never runs the real formatter (or writes to the real source tree). */
const noFormat = () => true;

function respondWith(payload: unknown, status = 200) {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(payload),
    } as unknown as Response),
  ) as unknown as typeof fetch;
}

/** What a successful sync of the fixture feed should leave on disk. */
function expectedOutput(): string {
  const content = toResumeContent(feedPayload());
  if (!content) throw new Error("expected the fixture feed to read cleanly");
  return renderResumeData(content);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sync-resume-"));
  target = join(dir, "resume-data.generated.ts");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("syncResume", () => {
  it("writes the generated module from the feed", async () => {
    const result = await syncResume({
      target,
      fetchImpl: respondWith(feedPayload()),
      format: noFormat,
    });

    expect(result).toEqual({ outcome: "written", changed: true });
    const written = await readFile(target, "utf-8");
    expect(written).toBe(expectedOutput());
    expect(written).toContain("GENERATED FILE - do not edit by hand.");
    expect(written).toContain("export const profile: Profile");
  });

  it("formats what it writes", async () => {
    const format = vi.fn(() => true);

    await syncResume({ target, fetchImpl: respondWith(feedPayload()), format });

    expect(format).toHaveBeenCalledWith(target);
  });

  it("reports an unchanged file without rewriting it", async () => {
    await writeFile(target, expectedOutput(), "utf-8");
    const format = vi.fn(() => true);

    const result = await syncResume({
      target,
      fetchImpl: respondWith(feedPayload()),
      format,
    });

    expect(result).toEqual({ outcome: "current", changed: false });
    expect(format).not.toHaveBeenCalled();
  });

  // An unreachable feed must not block a deploy - the committed copy is still
  // a perfectly good resume.
  it("leaves the file alone when the feed is unreachable", async () => {
    await writeFile(target, "// untouched\n", "utf-8");

    const result = await syncResume({
      target,
      fetchImpl: vi.fn(() => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch,
      format: noFormat,
    });

    expect(result).toEqual({ outcome: "unreachable", changed: false });
    expect(await readFile(target, "utf-8")).toBe("// untouched\n");
  });

  it("leaves the file alone for an error status", async () => {
    const result = await syncResume({
      target,
      fetchImpl: respondWith({}, 503),
      format: noFormat,
    });

    expect(result).toEqual({ outcome: "unreachable", changed: false });
  });

  // Reachable but malformed is a real problem, and writing nothing while
  // staying quiet would hide it.
  it("refuses to write a feed it cannot read", async () => {
    const result = await syncResume({
      target,
      fetchImpl: respondWith({ data: "nonsense" }),
      format: noFormat,
    });

    expect(result).toEqual({ outcome: "unreadable", changed: false });
  });

  describe("--check", () => {
    it("reports a stale file without writing", async () => {
      await writeFile(target, "// stale\n", "utf-8");

      const result = await syncResume({
        target,
        check: true,
        fetchImpl: respondWith(feedPayload()),
        format: noFormat,
      });

      expect(result).toEqual({ outcome: "stale", changed: true });
      expect(await readFile(target, "utf-8")).toBe("// stale\n");
    });

    it("reports a current file", async () => {
      await writeFile(target, expectedOutput(), "utf-8");

      const result = await syncResume({
        target,
        check: true,
        fetchImpl: respondWith(feedPayload()),
        format: noFormat,
      });

      expect(result).toEqual({ outcome: "current", changed: false });
    });

    // Compared as text, so a change to how the file is rendered counts as
    // staleness too - otherwise --check would pass on a file that no longer
    // matched what this script produces.
    it("treats a rendering-only difference as stale", async () => {
      await writeFile(target, `${expectedOutput()}\n// trailing edit\n`, "utf-8");

      const result = await syncResume({
        target,
        check: true,
        fetchImpl: respondWith(feedPayload()),
        format: noFormat,
      });

      expect(result.outcome).toBe("stale");
    });
  });

  it("treats a missing target as a change to write", async () => {
    const result = await syncResume({
      target,
      check: true,
      fetchImpl: respondWith(feedPayload()),
      format: noFormat,
    });

    expect(result).toEqual({ outcome: "stale", changed: true });
  });

  it("reads the url it is given", async () => {
    const fetchImpl = respondWith(feedPayload());

    await syncResume({
      target,
      url: "https://staging.example.com/resume.json",
      fetchImpl,
      format: noFormat,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://staging.example.com/resume.json",
      expect.anything(),
    );
  });
});

describe("formatGenerated", () => {
  it("formats a real file with the repo's oxfmt", async () => {
    await writeFile(target, 'export const x = {"a": 1};\n', "utf-8");

    expect(formatGenerated(target)).toBe(true);
    expect(await readFile(target, "utf-8")).toBe("export const x = { a: 1 };\n");
  });
});

describe("main", () => {
  it.each([
    ["written", 0],
    ["current", 0],
    ["unreachable", 0],
    ["stale", 1],
    ["unreadable", 1],
  ])("exits %s -> %i", async (outcome, code) => {
    const sync = vi.fn(() => Promise.resolve({ outcome, changed: false }));

    expect(await main([], sync as never)).toBe(code);
  });

  it("passes --check and --url through", async () => {
    const sync = vi.fn(() => Promise.resolve({ outcome: "current", changed: false }));

    await main(["--check", "--url", "https://example.com/feed.json"], sync as never);

    expect(sync).toHaveBeenCalledWith({ check: true, url: "https://example.com/feed.json" });
  });

  it("prints usage and exits 0 for --help", async () => {
    const sync = vi.fn();

    expect(await main(["--help"], sync as never)).toBe(0);
    expect(sync).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });

  it("exits 1 for an unknown flag", async () => {
    const sync = vi.fn();

    expect(await main(["--nope"], sync as never)).toBe(1);
    expect(sync).not.toHaveBeenCalled();
  });

  it("has a usage line", () => {
    printUsage();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("sync-resume"));
  });
});
