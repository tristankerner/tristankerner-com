import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import HomePage from "./+page.svelte";

describe("home page", () => {
  it("renders the Welcome heading from home.md", () => {
    render(HomePage);
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
  });
});
