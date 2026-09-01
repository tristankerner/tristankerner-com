import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { ResumeContent } from "../content";

const { buildResumeDocx, resumeFileName } = vi.hoisted(() => ({
  buildResumeDocx: vi.fn(),
  resumeFileName: vi.fn(),
}));
vi.mock("./resume-docx", () => ({ buildResumeDocx, resumeFileName }));

import DownloadResumeButton from "./DownloadResumeButton.svelte";

const content = { profile: { name: "Test Person" } } as unknown as ResumeContent;

describe("DownloadResumeButton", () => {
  let createObjectURL: ReturnType<typeof vi.fn<(obj: Blob | MediaSource) => string>>;
  let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let createdAnchor: HTMLAnchorElement | undefined;

  beforeEach(() => {
    buildResumeDocx.mockReset();
    resumeFileName.mockReset();

    // jsdom doesn't implement these - stub them directly on the real URL.
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    createdAnchor = undefined;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") createdAnchor = el as HTMLAnchorElement;
      return el;
    });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error - undoing the jsdom stub-in above.
    delete URL.createObjectURL;
    // @ts-expect-error - undoing the jsdom stub-in above.
    delete URL.revokeObjectURL;
  });

  it("renders an enabled button with the expected label", () => {
    render(DownloadResumeButton, { props: { content } });
    expect(screen.getByRole("button", { name: "Download résumé (.docx)" })).toBeEnabled();
  });

  it("builds and downloads the file on click, then revokes the object URL", async () => {
    const blob = new Blob(["fake"], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    buildResumeDocx.mockReturnValue(blob);
    resumeFileName.mockReturnValue("Test Person - Master Resume - 2026-01-01.docx");

    render(DownloadResumeButton, { props: { content } });
    await fireEvent.click(screen.getByRole("button", { name: "Download résumé (.docx)" }));

    await waitFor(() => expect(buildResumeDocx).toHaveBeenCalledWith(content));
    expect(resumeFileName).toHaveBeenCalledWith(content);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createdAnchor?.download).toBe("Test Person - Master Resume - 2026-01-01.docx");
    expect(createdAnchor?.href).toContain("blob:mock-url");

    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url"));
    expect(screen.getByRole("button", { name: "Download résumé (.docx)" })).toBeEnabled();
  });

  it("leaves the button enabled and announces an error when the builder throws", async () => {
    buildResumeDocx.mockImplementation(() => {
      throw new Error("boom");
    });
    resumeFileName.mockReturnValue("irrelevant.docx");

    render(DownloadResumeButton, { props: { content } });
    await fireEvent.click(screen.getByRole("button", { name: "Download résumé (.docx)" }));

    await waitFor(() =>
      expect(screen.getByText("Couldn't build the file — try again")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Download résumé (.docx)" })).toBeEnabled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
