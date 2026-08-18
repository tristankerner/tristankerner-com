import { resumeSchema } from "../resume.json/schema";

export const prerender = true;

// The field-level documentation for /resume.json. JSON Schema's `description`
// keyword is the standard place to put what would otherwise be code comments,
// which JSON itself has no way to carry.
export const GET = () =>
  new Response(
    `${JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...resumeSchema }, null, 2)}\n`,
    { headers: { "Content-Type": "application/json" } },
  );
