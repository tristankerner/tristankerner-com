import { describe, expect, it } from "vitest";
import { GET, prerender } from "./+server.ts";

describe("GET /resume.schema.json", () => {
  it("prerenders", () => {
    expect(prerender).toBe(true);
  });

  it("returns a JSON Schema document", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toBe("application/json");

    const schema = JSON.parse(await res.text());
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties)).toContain("work");
  });

  it("documents the fields that only exist for this feed", async () => {
    const { properties } = JSON.parse(await GET().text());
    const highlight = properties.work.items.properties.highlights.items.properties;

    expect(highlight.summary.description).toMatch(/verbatim/);
    expect(highlight.specifics.description).toMatch(/never paste verbatim/);
    expect(highlight.id.description).toMatch(/match on it rather than on summary text/);
  });

  // The withheld-data decision is part of the published contract, not just an
  // internal convention - a consumer reading only the schema must be able to
  // tell that figures are absent on purpose.
  it("states that quantified outcomes are withheld by design", async () => {
    const { properties } = JSON.parse(await GET().text());
    const highlight = properties.work.items.properties.highlights.items;

    expect(highlight.properties).not.toHaveProperty("metrics");
    expect(highlight.properties).not.toHaveProperty("tech");
    expect(highlight.description).toMatch(/no metrics field and no technology field, by design/);
  });
});
