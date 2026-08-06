import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import MemoryLanePage from "./+page.svelte";
import { memories } from "./content";

describe("memory-lane page", () => {
  it("renders a timeline entry for every memory, with a jump link in the index", () => {
    render(MemoryLanePage);
    for (const memory of memories) {
      expect(screen.getByRole("heading", { name: memory.title })).toBeInTheDocument();

      const jumpLink = screen.getByRole("link", { name: new RegExp(memory.title) });
      expect(jumpLink).toHaveAttribute("href", `#${memory.id}`);
    }
  });

  it("gives every timeline entry an anchor id matching its index link", () => {
    render(MemoryLanePage);
    for (const memory of memories) {
      expect(document.getElementById(memory.id)).toBeInTheDocument();
    }
  });

  it("renders the first slide of every memory's carousel", () => {
    render(MemoryLanePage);
    for (const memory of memories) {
      expect(screen.getByText(memory.slides[0].text)).toBeInTheDocument();
    }
  });

  it("renders an image for a memory whose first slide has one", () => {
    render(MemoryLanePage);
    // The carousel only mounts its current (first) slide until navigated, so
    // only images on a memory's first slide are visible without interaction.
    const firstSlidesWithImages = memories
      .map((memory) => memory.slides[0])
      .filter((slide) => slide.image);
    expect(firstSlidesWithImages.length).toBeGreaterThan(0);
    for (const slide of firstSlidesWithImages) {
      expect(screen.getByRole("img", { name: slide.image!.alt })).toBeInTheDocument();
    }
  });
});
