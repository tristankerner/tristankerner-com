import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import MemoryLanePage from "./+page.svelte";

describe("memory-lane page", () => {
  it("renders the coming-soon placeholder", () => {
    render(MemoryLanePage);
    expect(screen.getByRole("heading", { name: "Memory Ln" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon.")).toBeInTheDocument();
  });
});
