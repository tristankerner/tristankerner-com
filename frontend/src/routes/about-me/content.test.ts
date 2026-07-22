import { describe, expect, it } from "vitest";
import { promotedThroughText } from "./content";

// Synthetic fixtures, independent of the real resume data in content.ts, so
// these keep testing the generation logic even as that content changes.
describe("promotedThroughText", () => {
  it("returns an empty string when there is only one role", () => {
    expect(promotedThroughText({ roles: [{ title: "Engineer", duration: "2020 - 2024" }] })).toBe("");
  });

  it("mentions a single prior role with its duration", () => {
    expect(
      promotedThroughText({
        roles: [
          { title: "Senior Engineer", duration: "2022 - 2024" },
          { title: "Engineer", duration: "2020 - 2022" },
        ],
      }),
    ).toBe("Promoted through Engineer (2020 - 2022).");
  });

  it("joins two prior roles with an oxford comma", () => {
    expect(
      promotedThroughText({
        roles: [
          { title: "Senior Engineer", duration: "2023 - 2024" },
          { title: "Engineer", duration: "2021 - 2023" },
          { title: "Junior Engineer", duration: "2019 - 2021" },
        ],
      }),
    ).toBe("Promoted through Engineer (2021 - 2023), and Junior Engineer (2019 - 2021).");
  });

  it("joins three or more prior roles with commas and a trailing oxford comma", () => {
    expect(
      promotedThroughText({
        roles: [
          { title: "Staff Engineer", duration: "2023 - 2024" },
          { title: "Senior Engineer", duration: "2021 - 2023" },
          { title: "Engineer", duration: "2019 - 2021" },
          { title: "Junior Engineer", duration: "2018 - 2019" },
        ],
      }),
    ).toBe("Promoted through Senior Engineer (2021 - 2023), Engineer (2019 - 2021), and Junior Engineer (2018 - 2019).");
  });
});
