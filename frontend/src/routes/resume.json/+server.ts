import { buildResume } from "./payload";

export const prerender = true;

export const GET = () =>
  new Response(`${JSON.stringify(buildResume(), null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
