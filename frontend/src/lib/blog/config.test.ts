import { describe, expect, it } from "vitest";
import { POSTS_PER_PAGE, SITE_NAME, SITE_URL } from "./config";

describe("blog config", () => {
  it("exposes an absolute, protocol-qualified site URL", () => {
    expect(SITE_URL).toBe("https://tristankerner.com");
  });

  it("exposes the site name", () => {
    expect(SITE_NAME).toBe("Tristan Kerner");
  });

  it("exposes a positive page size", () => {
    expect(POSTS_PER_PAGE).toBeGreaterThan(0);
  });
});
