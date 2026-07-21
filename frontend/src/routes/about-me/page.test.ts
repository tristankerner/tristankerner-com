import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import AboutMePage from "./+page.svelte";

describe("about-me page", () => {
  it("renders the About heading", () => {
    render(AboutMePage);
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
  });
});
