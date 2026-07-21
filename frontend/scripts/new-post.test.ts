import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidDate, main, mdTemplate, printUsage, slugify, svelteTemplate } from "./new-post";

const POSTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "posts");

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Next Post!")).toBe("my-next-post");
  });

  it("strips accents", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--Hello--")).toBe("hello");
  });

  it("returns empty for a title with no usable characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("isValidDate", () => {
  it("accepts a real calendar date", () => {
    expect(isValidDate("2026-07-19")).toBe(true);
  });

  it("rejects a malformed string", () => {
    expect(isValidDate("07-19-2026")).toBe(false);
  });

  it("rejects a real-looking but non-existent date", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
  });
});

describe("templates", () => {
  it("mdTemplate embeds title and author as frontmatter", () => {
    const out = mdTemplate("My Title", "Someone");
    expect(out).toContain('title: "My Title"');
    expect(out).toContain('author: "Someone"');
  });

  it("svelteTemplate embeds title and author in a metadata export", () => {
    const out = svelteTemplate("My Title", "Someone");
    expect(out).toContain('title: "My Title"');
    expect(out).toContain("export const metadata");
  });
});

describe("printUsage", () => {
  it("prints a usage line", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printUsage();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });
});

describe("main - argument validation (no filesystem access reached)", () => {
  it("prints usage and returns on --help", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await main(["--help"]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("rejects missing required arguments", async () => {
    await expect(main([])).rejects.toThrow(/Missing required argument/);
  });

  it("rejects an invalid date", async () => {
    await expect(
      main(["--title", "t", "--author", "a", "--date", "not-a-date", "--template", "md"]),
    ).rejects.toThrow(/real calendar date/);
  });

  it("rejects an unknown template", async () => {
    await expect(
      main(["--title", "t", "--author", "a", "--date", "2026-07-19", "--template", "html"]),
    ).rejects.toThrow(/must be "svelte" or "md"/);
  });

  it("rejects a title with no usable slug characters", async () => {
    await expect(
      main(["--title", "!!!", "--author", "a", "--date", "2026-07-19", "--template", "md"]),
    ).rejects.toThrow(/usable characters/);
  });
});

// These exercise main()'s real filesystem writes (mocking node:fs/promises
// isn't reliable under Bun's runtime, which resolves node: built-ins itself
// rather than going through Vite's module graph). Dates are far-future
// fixture-only values, distinct from any real post, and every file this
// creates is removed in afterEach even if the test fails.
describe("main - filesystem effects", () => {
  const createdFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(createdFiles.splice(0).map((path) => rm(path, { force: true })));
  });

  it("rejects a post that already exists", async () => {
    const filepath = join(POSTS_DIR, "2099-01-03-vitest-fixture-existing.md");
    createdFiles.push(filepath);
    await writeFile(filepath, "placeholder", "utf-8");

    await expect(
      main([
        "--title",
        "Vitest Fixture Existing",
        "--author",
        "a",
        "--date",
        "2099-01-03",
        "--template",
        "md",
      ]),
    ).rejects.toThrow(/already exists/);
  });

  it("writes the scaffolded markdown post file on success", async () => {
    const filepath = join(POSTS_DIR, "2099-01-01-vitest-fixture-post.md");
    createdFiles.push(filepath);
    expect(existsSync(filepath)).toBe(false);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await main([
      "--title",
      "Vitest Fixture Post",
      "--author",
      "Someone",
      "--date",
      "2099-01-01",
      "--template",
      "md",
    ]);

    expect(existsSync(filepath)).toBe(true);
    const content = await readFile(filepath, "utf-8");
    expect(content).toContain("Write your post content here using Markdown.");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Permalink once built: /blog/2099-01-01/vitest-fixture-post"),
    );
  });

  it("writes the svelte template variant", async () => {
    const filepath = join(POSTS_DIR, "2099-01-02-vitest-fixture-post-2.svelte");
    createdFiles.push(filepath);

    await main([
      "--title",
      "Vitest Fixture Post 2",
      "--author",
      "Someone",
      "--date",
      "2099-01-02",
      "--template",
      "svelte",
    ]);

    const content = await readFile(filepath, "utf-8");
    expect(content).toContain("export const metadata");
  });
});
