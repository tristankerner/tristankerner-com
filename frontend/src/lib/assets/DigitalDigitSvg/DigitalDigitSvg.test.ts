import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import DigitalDigitSvg from "./DigitalDigitSvg.svelte";
import type { SingleDigit } from "./types";

const DIGIT_NAMES: Record<SingleDigit, string> = {
  "0": "Zero",
  "1": "One",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
};

describe("DigitalDigitSvg", () => {
  for (const [digit, name] of Object.entries(DIGIT_NAMES) as [SingleDigit, string][]) {
    it(`renders the "${name}" glyph for digit "${digit}"`, () => {
      const { container } = render(DigitalDigitSvg, { props: { digit } });
      expect(container.querySelector("title")?.textContent).toBe(name);
    });
  }

  it("defaults to digit 0 when no digit prop is given", () => {
    // @ts-expect-error digit is required by the Props type, but the component supplies a runtime default.
    const { container } = render(DigitalDigitSvg, { props: {} });
    expect(container.querySelector("title")?.textContent).toBe("Zero");
  });

  it("applies bgColor, textColor, strokeWidth, and class props", () => {
    const { container } = render(DigitalDigitSvg, {
      props: {
        digit: "5" as SingleDigit,
        bgColor: "#123456",
        textColor: "#abcdef",
        strokeWidth: 10,
        class: "my-class",
      },
    });

    expect(container.querySelector("svg")).toHaveClass("my-class");
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("#123456");
    expect(container.querySelector("path")?.getAttribute("stroke")).toBe("#abcdef");
    expect(container.querySelector("path")?.getAttribute("stroke-width")).toBe("10");
  });

  it("falls back to default colors and stroke width", () => {
    const { container } = render(DigitalDigitSvg, { props: { digit: "1" as SingleDigit } });
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("#FFFFFF");
    expect(container.querySelector("path")?.getAttribute("stroke")).toBe("#000000");
    expect(container.querySelector("path")?.getAttribute("stroke-width")).toBe("25");
  });
});
