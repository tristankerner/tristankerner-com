import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import AboutMePage from "./+page.svelte";
import { profile, skillGroups, certifications, jobs, personalProjects, promotedThroughText } from "./content";

// These tests assert against the content module's data rather than hardcoded
// resume text, so editing skillGroups/certifications/jobs/personalProjects
// in content.ts doesn't require touching this file.
describe("about-me page", () => {
  it("renders the profile name, title, and photo", () => {
    render(AboutMePage);
    expect(screen.getByRole("heading", { level: 1, name: profile.name })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: profile.name })).toBeInTheDocument();
    expect(screen.getAllByText(profile.title, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(profile.tagline, { exact: false }).length).toBeGreaterThan(0);
  });

  it("renders a heading for each top-level section", () => {
    render(AboutMePage);
    for (const heading of ["Summary", "Technical Skills", "Certifications", "Experience", "Personal Projects"]) {
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

  it("renders every certification with its id", () => {
    render(AboutMePage);
    for (const cert of certifications) {
      expect(screen.getAllByText(cert.name).length).toBeGreaterThan(0);
      expect(screen.getByText(`ID: ${cert.id}`)).toBeInTheDocument();
    }
  });

  it("renders a timeline entry for every job, with its current role and location details", () => {
    render(AboutMePage);
    for (const job of jobs) {
      expect(screen.getByRole("heading", { name: job.company })).toBeInTheDocument();
      expect(screen.getAllByText(job.roles[0].title, { exact: false }).length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(`${job.roles[0].duration} · ${job.roleLocation}`, { exact: false }).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(job.companyLocation, { exact: false }).length).toBeGreaterThan(0);

      const expectedPromotion = promotedThroughText(job);
      if (expectedPromotion) {
        expect(screen.getByText(expectedPromotion)).toBeInTheDocument();
      }

      for (const highlight of job.highlights) {
        expect(screen.getAllByText(highlight).length).toBeGreaterThan(0);
      }
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
});
