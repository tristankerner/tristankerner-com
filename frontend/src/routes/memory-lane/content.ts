import type { MemorySlide } from "$lib/memory-lane/types";
import memoryPlaceholder from "$lib/assets/memory-placeholder.svg";

export interface MemoryEntry {
  id: string;
  // ISO date (YYYY-MM-DD) — only the year is displayed on the timeline.
  // Keep this away from Jan 1/Dec 31: flowbite-svelte's TimelineItem parses
  // and formats it without pinning a timezone, so a date right at a year
  // boundary can display as the wrong year depending on the visitor's locale.
  date: string;
  title: string;
  slides: MemorySlide[];
}

// Placeholder entries showing the shape memory-lane content is expected to
// take: one timeline entry per memory, each with its own carousel of one or
// more slides, and each slide optionally carrying a photo. Swap the copy
// (and add real photos) for actual memories as they're written up.
export const memories: MemoryEntry[] = [
  {
    id: "2013-the-beginning",
    date: "2013-06-15",
    title: "Where It Started",
    slides: [
      {
        text: "Replace this with the story of how memory lane begins — a first job, a big move, a project that kicked things off.",
      },
      { text: "Add as many slides as a memory needs; each one can carry its own photo, or none at all." },
    ],
  },
  {
    id: "2017-a-milestone",
    date: "2017-06-15",
    title: "A Milestone",
    slides: [
      {
        text: "Drop a photo alongside the text for memories that deserve one.",
        image: { src: memoryPlaceholder, alt: "Placeholder photo — swap for a real one" },
      },
    ],
  },
  {
    id: "2021-new-chapter",
    date: "2021-06-15",
    title: "A New Chapter",
    slides: [
      { text: "Not every slide needs an image — plain text works fine too." },
      { text: "Keep entries short; the carousel is meant for quick moments, not essays." },
      { text: "Add a final beat to close out the memory before the next one begins." },
    ],
  },
  {
    id: "2026-today",
    date: "2026-06-15",
    title: "Today",
    slides: [{ text: "This is where the timeline catches up to now — update it as new memories happen." }],
  },
];
