export type Profile = { name: string; title: string; tagline: string };

export const profile: Profile = {
    name: "Tristan Kerner",
    title: "Senior Software Engineer",
    tagline: "Platform, Integrations, Salesforce",
};

export const summary =
    "I'm a software engineer with 13+ years building enterprise integrations, automation platforms, and API-driven SaaS " +
    "applications, both inside and outside the Salesforce ecosystem. I like turning messy, manual processes into reliable " +
    "systems — recent work cut integration failures by 89%, reduced Workato billing by 98%, and avoided roughly $850K in " +
    "projected annual overage costs. I've connected CRM, marketing, accounting, customer success, eCommerce, and payment " +
    "systems using REST/SOAP APIs, webhooks, Python, C#, SQL, and modern iPaaS tooling, partnering closely with Sales, " +
    "Marketing, Product, and executive stakeholders across the EdTech, wine, and fine art industries.";

export type Skill = { name: string; url?: string };
export type SkillGroup = { name: string; skills: Skill[] };

export const skillGroups: SkillGroup[] = [
    {
        name: "Languages",
        skills: [
            { name: "Python", url: "https://www.python.org/" },
            { name: "Apex", url: "https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide.htm" },
            { name: "C#", url: "https://learn.microsoft.com/en-us/dotnet/csharp/" },
            { name: "SQL" },
            { name: "TypeScript", url: "https://www.typescriptlang.org/" },
            { name: "JavaScript", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" },
            { name: "PHP", url: "https://www.php.net/" },
        ],
    },
    {
        name: "Integrations",
        skills: [
            { name: "Salesforce", url: "https://www.salesforce.com/" },
            { name: "Stripe", url: "https://stripe.com/" },
            { name: "Cvent", url: "https://www.cvent.com/" },
            { name: "SendGrid", url: "https://sendgrid.com/" },
            { name: "Workato", url: "https://www.workato.com/" },
            { name: "Fivetran", url: "https://www.fivetran.com/" },
            { name: "Marketing Cloud", url: "https://www.salesforce.com/marketing/" },
            { name: "Sage Intacct", url: "https://www.sage.com/en-us/sage-business-cloud/intacct/" },
            { name: "Drupal", url: "https://www.drupal.org/" },
            { name: "DocuSign", url: "https://www.docusign.com/" },
            { name: "HubSpot", url: "https://www.hubspot.com/" },
            { name: "Authorize.net", url: "https://www.authorize.net/" },
            { name: "National Credit-Reporting System, Inc.", url: "https://www.ncstrv.com/" },
            { name: "TaxStatus", url: "https://www.taxstatus.com/" },
            { name: "DropBox", url: "https://www.dropbox.com/" },
            { name: "Box", url: "https://www.box.com/" },
            { name: "ShipCompliant", url: "https://sovos.com/shipcompliant/" },
            { name: "FedEx", url: "https://www.fedex.com/" },
            { name: "Beverage Data Network (BDN) / Vermont Information Processing (VIP)", url: "https://public.vtinfo.com/" },
            { name: "REST APIs", url: "https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm" },
            { name: "SOAP APIs", url: "https://www.w3.org/TR/soap/" },
            { name: "GraphQL", url: "https://graphql.org/" },
        ],
    },
    {
        name: "Data Platforms",
        skills: [
            { name: "Databricks", url: "https://www.databricks.com/" },
            { name: "Delta Lake", url: "https://delta.io/" },
        ],
    },
    {
        name: "Databases & Tools",
        skills: [
            { name: "PostgreSQL", url: "https://www.postgresql.org/" },
            { name: "MySQL", url: "https://www.mysql.com/" },
            { name: "DuckDB", url: "https://duckdb.org/" },
            { name: "Git", url: "https://git-scm.com/" },
            { name: "Jira", url: "https://www.atlassian.com/software/jira" },
            { name: "SFDX CLI", url: "https://developer.salesforce.com/tools/salesforcecli" },
            {
                name: "Force.com Ant Migration Tool",
                url: "https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/meta_development.htm",
            },
            { name: "Postman", url: "https://www.postman.com/" },
            { name: "Bruno", url: "https://www.usebruno.com/" },
            { name: "Salesforce Data Loader", url: "https://developer.salesforce.com/tools/data-loader" },
        ],
    },
    {
        name: "Cloud & DevOps",
        skills: [
            { name: "AWS", url: "https://aws.amazon.com/" },
            { name: "CI/CD" },
            { name: "GitHub Actions", url: "https://github.com/features/actions" },
            { name: "CircleCI", url: "https://circleci.com/" },
            { name: "BitBucket Pipelines", url: "https://www.atlassian.com/software/bitbucket/features/pipelines" },
            { name: "Docker", url: "https://www.docker.com/" },
        ],
    },
    {
        name: "Backend",
        skills: [
            { name: ".NET", url: "https://dotnet.microsoft.com/" },
            { name: "ASP.NET Core", url: "https://dotnet.microsoft.com/en-us/apps/aspnet" },
            { name: "Node.js", url: "https://nodejs.org/" },
            { name: "PySpark", url: "https://spark.apache.org/docs/latest/api/python/index.html" },
            { name: "Salesforce Apex Enterprise Design Patterns", url: "https://github.com/apex-enterprise-patterns" }
        ],
    },
    {
        name: "Frontend",
        skills: [
            { name: "React", url: "https://react.dev/" },
            { name: "Lightning Web Components", url: "https://developer.salesforce.com/docs/platform/lwc/guide" },
            { name: "Visualforce", url: "https://developer.salesforce.com/docs/atlas.en-us.pages.meta/pages/pages_intro.htm" },
            {
                name: "Aura Components",
                url: "https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/intro_components.htm",
            },
            { name: "SLDS", url: "https://www.lightningdesignsystem.com/" },
            { name: "Vue.js", url: "https://vuejs.org/" },
            { name: "Svelte", url: "https://svelte.dev/" },
            { name: "Tailwind", url: "https://tailwindcss.com/" },
            { name: "HTML", url: "https://developer.mozilla.org/en-US/docs/Web/HTML" },
            { name: "CSS", url: "https://developer.mozilla.org/en-US/docs/Web/CSS" },
            { name: "Foundation for Sites", url: "https://get.foundation/sites.html" },
            { name: "MJML", url: "https://mjml.io/" },
        ],
    },
    {
        name: "Architecture",
        skills: [
            { name: "Microservices", url: "https://martinfowler.com/articles/microservices.html" },
            { name: "Event-Driven Architecture" },
            { name: "System Design" },
            { name: "API Design" },
            { name: "Integration Architecture" },
            { name: "Observability" },
        ],
    },
    {
        name: "Identity & Security",
        skills: [
            { name: "Okta", url: "https://www.okta.com/" },
            { name: "Keycloak", url: "https://www.keycloak.org/" },
            { name: "SSO" },
            { name: "RBAC", url: "https://csrc.nist.gov/projects/role-based-access-control" },
            { name: "Access Reviews" },
        ],
    },
];

export type Certification = { name: string; id: string; url?: string };

export const certifications: Certification[] = [
    {
        name: "Salesforce Certified Platform Developer I",
        id: "7922219",
        url: "https://trailhead.salesforce.com/credentials/platformdeveloperi",
    },
    {
        name: "Salesforce Certified Platform Developer II",
        id: "7959126",
        url: "https://trailhead.salesforce.com/credentials/platformdeveloperii",
    },
    {
        name: "Databricks Lakehouse Fundamentals",
        id: "103417846",
        url: "https://www.databricks.com/learn/certification/lakehouse-platform-fundamentals",
    },
    { name: "Workato Foundations Level 1", id: "187474359", url: "https://academy.workato.com/workato-foundations-1" },
    { name: "Workato Foundations Level 2", id: "187476397", url: "https://academy.workato.com/workato-foundations-2" },
];

export type Role = { title: string; duration: string };
export type RoleLocation = "On-site" | "Hybrid" | "Remote";

export type Job = {
    company: string;
    companyUrl?: string;
    companyLocation: string;
    duration: string;
    description: string;
    roleLocation: RoleLocation;
    roles: Role[];
    highlights: string[];
};

// roles are ordered most-recent first; everything after the first entry
// is prior-role history used to generate the "Promoted through" line.
export function promotedThroughText({ roles }: Pick<Job, "roles">): string {
    const priorRoles = roles.slice(1).map((r) => `${r.title} (${r.duration})`);
    if (priorRoles.length === 0) return "";
    if (priorRoles.length === 1) return `Promoted through ${priorRoles[0]}.`;
    const last = priorRoles.at(-1);
    const rest = priorRoles.slice(0, -1).join(", ");
    return `Promoted through ${rest}, and ${last}.`;
}

export const jobs: Job[] = [
    {
        company: "Independent School Management",
        companyUrl: "https://isminc.com/",
        companyLocation: "Wilmington, DE",
        duration: "August 2022 - May 2026",
        description:
            "ISM is dedicated to the advancement of school management by providing creative strategies, proven management techniques, personalized service, and EdTech SaaS solutions.",
        roleLocation: "Remote",
        roles: [
            { title: "Senior Software Engineer, Platform / Integrations / Salesforce", duration: "2024 - 2026" },
            { title: "Integration/Data Engineer, Salesforce Developer", duration: "2023 - 2024" },
            { title: "Backend Developer, Salesforce Developer, Integration Engineer", duration: "2022 - 2023" },
        ],
        highlights: [
            "Redesigned enterprise integration architecture for business-critical SaaS workflows, reducing Workato billable usage by 98%, cutting integration failures by 89%, and avoiding roughly $850K in projected annual overage costs.",
            "Designed and deployed centralized monitoring, alerting, and observability tooling across 100+ integrations spanning 10+ SaaS and internal systems, reducing incident detection time by 90%.",
            "Architected fault-tolerant, bidirectional integrations and scalable worker-queue processes for a web-based SaaS platform, supporting real-time events, scheduled bulk jobs, and idempotent retry logic.",
            "Co-designed and implemented a Databricks Lakehouse platform consolidating data from 10+ business systems via Fivetran, Lakeflow Connect, and custom Python ETL pipelines.",
            "Built PySpark and SQL-based validation, transformation, data quality monitoring, reverse ETL, and self-service analytics workflows to improve data reliability and accessibility.",
            "Developed Salesforce customizations with Apex, Lightning Web Components, Flows, custom objects, validation rules, and platform integrations to support business-critical workflows and data synchronization.",
            "Designed and maintained SaaS platform features for document management, communications, tax verification, and reporting, improving reliability and usability for customer-facing workflows.",
            "Partnered with product and business stakeholders across multiple time zones to define MVP scope, ship faster, and prioritize follow-on iterations based on user and operational needs.",
            "Investigated and resolved complex production issues across custom applications, integrations, and Salesforce environments using code analysis, monitoring data, and root-cause troubleshooting.",
            "Contributed to security policy development, remediation efforts, penetration test follow-up, and recurring access reviews as part of the company's security team.",
            "Launched and governed a company-wide documentation platform that improved knowledge sharing, standardized technical processes, and reduced operational dependency on tribal knowledge.",
        ],
    },
    {
        company: "Bespoke Collection",
        companyLocation: "Napa, CA",
        duration: "October 2013 - August 2022",
        description: "Parent group of Blackbird Vineyards and Aerena Galleries & Gardens — DTC wine and fine art brands",
        roleLocation: "Hybrid",
        roles: [
            { title: "Software & Systems Integration Lead", duration: "2019 - 2022" },
            { title: "Salesforce Admin/Developer & Integration Engineer", duration: "2014 - 2019" },
            { title: "Web Developer", duration: "2013 - 2014" },
        ],
        highlights: [
            "Led development and systems integration strategy across multiple brands and six physical locations, supporting day-to-day business operations as well as high-level data analytics needs.",
            "Designed and developed a headless eCommerce platform serving 60,000+ customers across multiple brands, with Salesforce as the system of record for customer, pricing, rewards, and product data; enabled personalized pricing, rewards programs, and cross-brand commerce experiences.",
            "Engineered a time-limited cart hold and inventory reservation system, similar to ticket reservation platforms, enabling online sales of one-of-a-kind artwork by temporarily locking held items to prevent duplicate purchases while in another customer's cart.",
            "Built and evolved custom integrations across Salesforce, eCommerce, point-of-sale, shipping, marketing, payment processing, and compliance systems, improving reliability and reducing manual work across direct-to-consumer and wholesale operations.",
            "Owned Salesforce administration and development company-wide, including user access and permissions, workflow automation, data quality, reporting, configuration, and ongoing support for business-critical operations.",
            "Developed CI/CD automation and Salesforce migration tooling using Apex, Python, REST APIs, Salesforce CLI, and Ant Migration Tool for heavily customized multi-brand environments, reducing manual deployment effort and improving data consistency.",
            "Partnered with executives and business stakeholders to design Salesforce applications for inventory tracking, financial reporting, commissions, consignment, and reservations, improving operational visibility across multiple brands.",
            "Negotiated technology vendor contracts and services, managed SaaS licenses, and maintained department financial budgets and forecasts.",
        ],
    },
];

export type PersonalProject = { name?: string; link?: string; description: string };

export const personalProjects: PersonalProject[] = [
    {
        description:
            "Implemented a fault-tolerant, scalable integration system in Python as a proof of concept, using RabbitMQ, Redis, PostgreSQL, and FastAPI.",
    },
    {
        name: "This Website",
        description:
            "Built this personal site and blog with Rust, actix-web, SvelteKit, Tailwind, and Flowbite — optimized to run on minimal hardware.",
    },
];
