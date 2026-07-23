import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";

const { pageState } = vi.hoisted(() => ({
  pageState: { status: 404, error: null as { message: string } | null },
}));
vi.mock("$app/state", () => ({
  get page() {
    return pageState;
  },
}));

import ErrorPage from "./+error.svelte";

describe("error page", () => {
  it("shows a not-found message and status for a 404", () => {
    pageState.status = 404;
    pageState.error = null;

    render(ErrorPage);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText(/doesn't exist or may have moved/)).toBeInTheDocument();
  });

  it("shows the error message for a non-404 status", () => {
    pageState.status = 500;
    pageState.error = { message: "Boom" };

    render(ErrorPage);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("falls back to a generic message when a non-404 error has none", () => {
    pageState.status = 500;
    pageState.error = null;

    render(ErrorPage);

    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });

  it("links back to the home page", () => {
    pageState.status = 404;
    pageState.error = null;

    render(ErrorPage);

    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });
});
