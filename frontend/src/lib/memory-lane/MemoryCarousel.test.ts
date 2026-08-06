import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import MemoryCarousel from "./MemoryCarousel.svelte";
import type { MemorySlide } from "./types";

describe("MemoryCarousel", () => {
  it("renders the first slide's text", () => {
    const slides: MemorySlide[] = [{ text: "First slide" }, { text: "Second slide" }];
    render(MemoryCarousel, { props: { slides, ariaLabel: "Test memory" } });

    expect(screen.getByText("First slide")).toBeInTheDocument();
    expect(screen.queryByText("Second slide")).not.toBeInTheDocument();
  });

  it("renders a slide's image when it has one", () => {
    const slides: MemorySlide[] = [
      { text: "With a photo", image: { src: "/photo.jpg", alt: "A photo" } },
    ];
    render(MemoryCarousel, { props: { slides, ariaLabel: "Test memory" } });

    expect(screen.getByRole("img", { name: "A photo" })).toHaveAttribute("src", "/photo.jpg");
  });

  it("renders no image for a slide that doesn't have one", () => {
    const slides: MemorySlide[] = [{ text: "No photo here" }];
    render(MemoryCarousel, { props: { slides, ariaLabel: "Test memory" } });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("hides prev/next controls and indicators for a single-slide memory", () => {
    const slides: MemorySlide[] = [{ text: "Only slide" }];
    render(MemoryCarousel, { props: { slides, ariaLabel: "Test memory" } });

    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to slide 1" })).not.toBeInTheDocument();
  });

  it("advances to the next slide when Next is clicked", async () => {
    const slides: MemorySlide[] = [{ text: "First slide" }, { text: "Second slide" }];
    render(MemoryCarousel, { props: { slides, ariaLabel: "Test memory" } });

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Second slide")).toBeInTheDocument();
  });
});
