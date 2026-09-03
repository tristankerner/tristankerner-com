import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import AboutMePage from "./+page.svelte";
import {
  profile,
  skillGroups,
  certifications,
  jobs,
  jobDurationText,
  personalProjects,
  promotedThroughText,
  roleDurationText,
  summary,
  viaEmployerText,
} from "./content";
import { CACHE_TTL_MS, writeCache } from "./remote";
import { feedPayload } from "./feed.fixture";

// These tests assert against the content module's data rather than hardcoded
// resume text, so editing skillGroups/certifications/jobs/personalProjects
// in content.ts doesn't require touching this file.
describe("about-me page", () => {
  // Mounting the page kicks off a fetch of the live resume feed. Left alone
  // that would make this suite depend on a third-party service being up (and
  // quietly hit it on every run), so every test below runs against an
  // unreachable feed - which is also the path that has to keep rendering the
  // built-in content the assertions here are written against. The few tests
  // that care about live data override this.
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    // fetchResume reports an unreachable feed on the console by design; that's
    // signal in a browser and noise in a test run.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the profile name, title, and photo", () => {
    render(AboutMePage);
    expect(screen.getByRole("heading", { level: 1, name: profile.name })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: profile.name })).toBeInTheDocument();
    expect(screen.getAllByText(profile.title, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(profile.tagline, { exact: false }).length).toBeGreaterThan(0);
  });

  it("renders a heading for each top-level section", () => {
    render(AboutMePage);
    for (const heading of [
      "Summary",
      "Technical Skills",
      "Certifications",
      "Experience",
      "Personal Projects",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("renders every skill group and its skills", () => {
    render(AboutMePage);
    for (const group of skillGroups) {
      expect(screen.getByRole("heading", { name: group.name })).toBeInTheDocument();
      for (const skill of group.skills) {
        expect(screen.getAllByText(skill.name).length).toBeGreaterThan(0);
      }
    }
  });

  it("renders every certification, with an id only when the issuer numbers it", () => {
    render(AboutMePage);
    for (const cert of certifications) {
      expect(screen.getAllByText(cert.name).length).toBeGreaterThan(0);
      if (cert.id) {
        expect(screen.getAllByText(cert.id).length).toBeGreaterThan(0);
      }
    }
    // getNodeText matches on direct text children only, so the "ID:" label
    // matches independently of the id in its nested span. One label per
    // numbered credential, and none for the rest - an unguarded render emits a
    // dangling "ID:" with nothing after it.
    expect(screen.queryAllByText("ID:", { exact: true })).toHaveLength(
      certifications.filter((cert) => cert.id).length,
    );
  });

  it("renders a timeline entry for every job, with its current role and location details", () => {
    render(AboutMePage);
    for (const job of jobs) {
      expect(screen.getByRole("heading", { name: job.company })).toBeInTheDocument();
      expect(screen.getAllByText(job.roles[0].title, { exact: false }).length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(roleDurationText(job.roles[0]), { exact: false }).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(jobDurationText(job), { exact: false }).length).toBeGreaterThan(0);
      expect(screen.getAllByText(job.roleLocation, { exact: false }).length).toBeGreaterThan(0);
      expect(screen.getAllByText(job.companyLocation, { exact: false }).length).toBeGreaterThan(0);

      const expectedPromotion = promotedThroughText(job);
      if (expectedPromotion) {
        expect(screen.getByText(expectedPromotion)).toBeInTheDocument();
      }

      if (job.viaEmployer) {
        expect(screen.getByText(viaEmployerText(job))).toBeInTheDocument();
      }

      for (const highlight of job.highlights) {
        expect(screen.getAllByText(highlight.summary).length).toBeGreaterThan(0);
      }
    }
  });

  it("only renders a highlight as an expandable accordion when it has specifics", () => {
    render(AboutMePage);
    for (const job of jobs) {
      for (const highlight of job.highlights) {
        const [summaryEl] = screen.getAllByText(highlight.summary);
        if (highlight.specifics.length > 0) {
          expect(summaryEl.closest("button")).toBeInTheDocument();
        } else {
          expect(summaryEl.closest("button")).not.toBeInTheDocument();
        }
      }
    }
  });

  it("expands a highlight's specifics on click and hides them beforehand", async () => {
    render(AboutMePage);
    const [job] = jobs;
    const highlightWithSpecifics = job.highlights.find((h) => h.specifics.length > 0);
    if (!highlightWithSpecifics)
      throw new Error("expected a highlight with specifics in fixture data");

    for (const specific of highlightWithSpecifics.specifics) {
      expect(screen.queryByText(specific.detail)).not.toBeInTheDocument();
    }

    const [summaryEl] = screen.getAllByText(highlightWithSpecifics.summary);
    const button = summaryEl.closest("button");
    if (!button) throw new Error("expected highlight summary to be inside an accordion button");
    await fireEvent.click(button);

    for (const specific of highlightWithSpecifics.specifics) {
      expect(screen.getAllByText(specific.detail).length).toBeGreaterThan(0);
    }
  });

  it("renders every personal project, with or without a name", () => {
    render(AboutMePage);
    for (const project of personalProjects) {
      if (project.name) {
        expect(screen.getAllByText(project.name).length).toBeGreaterThan(0);
      }
      expect(screen.getAllByText(project.description).length).toBeGreaterThan(0);
    }
  });

  it("does not render a skill, certification, or company as a link when it has no url", () => {
    render(AboutMePage);
    for (const group of skillGroups) {
      for (const skill of group.skills) {
        if (!skill.url) {
          expect(screen.queryByRole("link", { name: skill.name })).not.toBeInTheDocument();
        }
      }
    }
    for (const cert of certifications) {
      if (!cert.url) {
        expect(screen.queryByRole("link", { name: cert.name })).not.toBeInTheDocument();
      }
    }
    for (const job of jobs) {
      if (!job.companyUrl) {
        expect(screen.queryByRole("link", { name: job.company })).not.toBeInTheDocument();
      }
    }
  });

  it("renders a skill as a link opening in a new tab when it has a url", () => {
    const [group] = skillGroups;
    const [skill] = group.skills;
    const originalUrl = skill.url;
    skill.url = "https://example.com/skill";
    try {
      render(AboutMePage);
      const link = screen.getByRole("link", { name: skill.name });
      expect(link).toHaveAttribute("href", "https://example.com/skill");
      expect(link).toHaveAttribute("target", "_blank");
    } finally {
      skill.url = originalUrl;
    }
  });

  it("renders a certification as a link opening in a new tab when it has a url", () => {
    const [cert] = certifications;
    const originalUrl = cert.url;
    cert.url = "https://example.com/cert";
    try {
      render(AboutMePage);
      const link = screen.getByRole("link", { name: cert.name });
      expect(link).toHaveAttribute("href", "https://example.com/cert");
      expect(link).toHaveAttribute("target", "_blank");
    } finally {
      cert.url = originalUrl;
    }
  });

  it("renders a company name as a link opening in a new tab when it has a companyUrl", () => {
    const [job] = jobs;
    const originalUrl = job.companyUrl;
    job.companyUrl = "https://example.com/company";
    try {
      render(AboutMePage);
      const link = screen.getByRole("link", { name: job.company });
      expect(link).toHaveAttribute("href", "https://example.com/company");
      expect(link).toHaveAttribute("target", "_blank");
    } finally {
      job.companyUrl = originalUrl;
    }
  });

  // The page renders the resume the microservice serves, falling back to the
  // copy compiled into the build. Every test above exercises that fallback;
  // these cover the live path and what the visitor sees on the way to it.
  describe("live content from the resume feed", () => {
    function stubFeed(response: Promise<Response>) {
      const fetchImpl = vi.fn(() => response);
      vi.stubGlobal("fetch", fetchImpl);
      return fetchImpl;
    }

    function feedResponse(payload: unknown): Promise<Response> {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as unknown as Response);
    }

    it("replaces the built-in content once the feed arrives", async () => {
      stubFeed(feedResponse(feedPayload()));
      render(AboutMePage);

      // The prerendered content is what's on screen until the fetch resolves.
      expect(screen.getByRole("heading", { level: 1, name: profile.name })).toBeInTheDocument();

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: "Feed Profile Name" }),
        ).toBeInTheDocument();
      });
      expect(screen.getByText("Feed summary paragraph.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Feed Current Company" })).toBeInTheDocument();
      expect(screen.getAllByText("Feed Named Project").length).toBeGreaterThan(0);
      expect(screen.queryByText(profile.tagline)).not.toBeInTheDocument();
    });

    it("shows a spinner while the feed is in flight and removes it afterwards", async () => {
      let resolveFeed: (response: Response) => void = () => {};
      stubFeed(new Promise<Response>((resolve) => (resolveFeed = resolve)));
      render(AboutMePage);

      expect(await screen.findByText("Loading the latest resume content")).toBeInTheDocument();

      resolveFeed({
        ok: true,
        status: 200,
        json: () => Promise.resolve(feedPayload()),
      } as unknown as Response);

      await waitFor(() => {
        expect(screen.queryByText("Loading the latest resume content")).not.toBeInTheDocument();
      });
    });

    it("uses a fresh cached copy without going to the network at all", async () => {
      writeCache(feedPayload());
      const fetchImpl = stubFeed(feedResponse(feedPayload()));
      render(AboutMePage);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: "Feed Profile Name" }),
        ).toBeInTheDocument();
      });
      expect(fetchImpl).not.toHaveBeenCalled();
      // Nothing was fetched, so there was never anything to spin for.
      expect(screen.queryByText("Loading the latest resume content")).not.toBeInTheDocument();
    });

    it("keeps the built-in content, and stops spinning, when the feed is unreachable", async () => {
      render(AboutMePage);

      await waitFor(() => {
        expect(screen.queryByText("Loading the latest resume content")).not.toBeInTheDocument();
      });
      expect(screen.getByRole("heading", { level: 1, name: profile.name })).toBeInTheDocument();
      expect(screen.getByText(summary)).toBeInTheDocument();
    });

    it("ignores a stale cached copy and fetches instead", async () => {
      writeCache(feedPayload(), Date.now() - CACHE_TTL_MS);
      const fetchImpl = stubFeed(feedResponse(feedPayload()));
      render(AboutMePage);

      await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    });
  });
});
