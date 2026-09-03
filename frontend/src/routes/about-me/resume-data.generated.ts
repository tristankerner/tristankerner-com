// GENERATED FILE - do not edit by hand.
//
// Written by `bun run sync-resume` (frontend/scripts/sync-resume.ts) from the
// resume microservice's public feed, and regenerated in CI before every
// production build. To change any of this, edit the resume in that service and
// re-run the command - edits made here are lost on the next sync.
//
// This is the copy of the resume compiled into the build: what the prerendered
// about-me page contains (so it is what search engines index and what a
// visitor without JavaScript reads), and what the page falls back to when the
// feed is unreachable. See ./content.ts for the types and the helpers that
// derive display prose from these values, and ./remote.ts for the runtime
// fetch that supersedes them in the browser.

import type {
  Certification,
  Contact,
  Education,
  Job,
  PersonalProject,
  Profile,
  SkillGroup,
} from "./content";

export const profile: Profile = {
  name: "Tristan Kerner",
  title: "Senior Software Engineer & Administrator",
  tagline: "Full-Stack, Integrations, Data, Salesforce",
};

export const contact: Contact = {
  locations: [
    {
      label: "Remote (USA)",
      kind: "remote",
      note: "Default. Use for remote-first postings, or any posting that does not screen on geography.",
    },
    {
      label: "San Francisco Bay Area",
      kind: "metro",
      note: "Use when the posting is on-site or hybrid anywhere in the Bay Area, or names the metro rather than a city.",
    },
    {
      label: "Napa, CA",
      kind: "residence",
      note: "Use when the posting is on-site or hybrid in or near Napa, or asks for a specific city.",
    },
  ],
  links: [
    {
      label: "Website",
      url: "https://www.tristankerner.com",
    },
    {
      label: "LinkedIn",
      url: "https://www.linkedin.com/in/tristan-kerner-754343135",
    },
    {
      label: "GitHub",
      url: "https://github.com/tristankerner",
    },
  ],
};

export const summary: string =
  "Senior software engineer and business systems specialist with 17+ years building enterprise integrations, automation platforms, and API-driven SaaS applications inside and outside the Salesforce ecosystem. Recent work cut integration failures by 89%, reduced Workato billable usage by 98%, and avoided roughly $850K in projected annual overage costs. Pairs hands-on engineering (Python, C#, Apex, SQL, REST/SOAP APIs, modern iPaaS) with business analysis depth — requirements elicitation, process mapping, gap analysis, and UAT — partnering with Sales, Marketing, Product, and executive stakeholders on Agile teams to turn business requirements into reliable, scalable, well-tested solutions across enterprise SaaS, eCommerce, and DTC environments.";

export const skillGroups: SkillGroup[] = [
  {
    name: "Languages",
    skills: [
      {
        name: "Python",
        url: "https://www.python.org/",
      },
      {
        name: "Apex",
        url: "https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide.htm",
      },
      {
        name: "C#",
        url: "https://learn.microsoft.com/en-us/dotnet/csharp/",
      },
      {
        name: "SQL",
      },
      {
        name: "TypeScript",
        url: "https://www.typescriptlang.org/",
      },
      {
        name: "JavaScript",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      },
      {
        name: "PHP",
        url: "https://www.php.net/",
      },
    ],
  },
  {
    name: "Integrations",
    skills: [
      {
        name: "Salesforce",
        url: "https://www.salesforce.com/",
      },
      {
        name: "Stripe",
        url: "https://stripe.com/",
      },
      {
        name: "Cvent",
        url: "https://www.cvent.com/",
      },
      {
        name: "SendGrid",
        url: "https://sendgrid.com/",
      },
      {
        name: "Workato",
        url: "https://www.workato.com/",
      },
      {
        name: "Fivetran",
        url: "https://www.fivetran.com/",
      },
      {
        name: "Bookstack",
        url: "https://www.bookstackapp.com/",
      },
      {
        name: "Marketing Cloud",
        url: "https://www.salesforce.com/marketing/",
      },
      {
        name: "Sage Intacct",
        url: "https://www.sage.com/en-us/sage-business-cloud/intacct/",
      },
      {
        name: "Drupal",
        url: "https://www.drupal.org/",
      },
      {
        name: "DocuSign",
        url: "https://www.docusign.com/",
      },
      {
        name: "HubSpot",
        url: "https://www.hubspot.com/",
      },
      {
        name: "Authorize.net",
        url: "https://www.authorize.net/",
      },
      {
        name: "National Credit-Reporting System, Inc.",
        url: "https://www.ncstrv.com/",
      },
      {
        name: "TaxStatus",
        url: "https://www.taxstatus.com/",
      },
      {
        name: "DropBox",
        url: "https://www.dropbox.com/",
      },
      {
        name: "Box",
        url: "https://www.box.com/",
      },
      {
        name: "ShipCompliant",
        url: "https://sovos.com/shipcompliant/",
      },
      {
        name: "FedEx",
        url: "https://www.fedex.com/",
      },
      {
        name: "Beverage Data Network (BDN) / Vermont Information Processing (VIP)",
        url: "https://public.vtinfo.com/",
      },
      {
        name: "REST APIs",
        url: "https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm",
      },
      {
        name: "SOAP APIs",
        url: "https://www.w3.org/TR/soap/",
      },
      {
        name: "GraphQL",
        url: "https://graphql.org/",
      },
    ],
  },
  {
    name: "Data Platforms",
    skills: [
      {
        name: "Databricks",
        url: "https://www.databricks.com/",
      },
      {
        name: "Delta Lake",
        url: "https://delta.io/",
      },
      {
        name: "Lakeflow Connect",
        url: "https://www.databricks.com/product/lakeflow-connect",
      },
    ],
  },
  {
    name: "Databases & Tools",
    skills: [
      {
        name: "PostgreSQL",
        url: "https://www.postgresql.org/",
      },
      {
        name: "MySQL",
        url: "https://www.mysql.com/",
      },
      {
        name: "DuckDB",
        url: "https://duckdb.org/",
      },
      {
        name: "Git",
        url: "https://git-scm.com/",
      },
      {
        name: "Jira",
        url: "https://www.atlassian.com/software/jira",
      },
      {
        name: "SFDX CLI",
        url: "https://developer.salesforce.com/tools/salesforcecli",
      },
      {
        name: "Force.com Ant Migration Tool",
        url: "https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/meta_development.htm",
      },
      {
        name: "Postman",
        url: "https://www.postman.com/",
      },
      {
        name: "Bruno",
        url: "https://www.usebruno.com/",
      },
      {
        name: "Salesforce Data Loader",
        url: "https://developer.salesforce.com/tools/data-loader",
      },
      {
        name: "Workato Developer SDK",
        url: "https://docs.workato.com/en/developing-connectors/sdk.html",
      },
    ],
  },
  {
    name: "Platform Administration",
    skills: [
      {
        name: "Salesforce",
        url: "https://www.salesforce.com",
      },
      {
        name: "Salesforce Marketing Cloud",
        url: "https://www.salesforce.com",
      },
      {
        name: "Workato",
        url: "https://www.workato.com/",
      },
      {
        name: "Docusign",
        url: "https://www.docusign.com/",
      },
      {
        name: "Box",
        url: "https://www.box.com",
      },
      {
        name: "Bookstack",
        url: "https://www.bookstackapp.com/",
      },
      {
        name: "ShipCompliant",
        url: "https://sovos.com/shipcompliant/",
      },
      {
        name: "3CX",
        url: "https://www.3cx.com/",
      },
      {
        name: "Kaseya VSA",
        url: "https://www.kaseya.com/products/rmm-software/",
      },
      {
        name: "Bitdefender GravityZone Control Center",
        url: "https://gravityzone.bitdefender.com/",
      },
      {
        name: "Snipe-IT",
        url: "https://snipeitapp.com/",
      },
    ],
  },
  {
    name: "Cloud & DevOps",
    skills: [
      {
        name: "AWS",
        url: "https://aws.amazon.com/",
      },
      {
        name: "CI/CD",
      },
      {
        name: "GitHub Actions",
        url: "https://github.com/features/actions",
      },
      {
        name: "CircleCI",
        url: "https://circleci.com/",
      },
      {
        name: "BitBucket Pipelines",
        url: "https://www.atlassian.com/software/bitbucket/features/pipelines",
      },
      {
        name: "Docker",
        url: "https://www.docker.com/",
      },
    ],
  },
  {
    name: "Backend",
    skills: [
      {
        name: ".NET (8 & 9)",
        url: "https://dotnet.microsoft.com/",
      },
      {
        name: "ASP.NET Core 14.5",
        url: "https://dotnet.microsoft.com/en-us/apps/aspnet",
      },
      {
        name: "Entity Framework Core 9",
        url: "https://learn.microsoft.com/en-us/ef/core/",
      },
      {
        name: "Node.js",
        url: "https://nodejs.org/",
      },
      {
        name: "Laravel",
        url: "https://laravel.com/",
      },
      {
        name: "Hasura",
        url: "https://hasura.io/",
      },
      {
        name: "PySpark",
        url: "https://spark.apache.org/docs/latest/api/python/index.html",
      },
      {
        name: "Salesforce Apex Enterprise Design Patterns",
        url: "https://github.com/apex-enterprise-patterns",
      },
    ],
  },
  {
    name: "Frontend",
    skills: [
      {
        name: "React",
        url: "https://react.dev/",
      },
      {
        name: "Lightning Web Components",
        url: "https://developer.salesforce.com/docs/platform/lwc/guide",
      },
      {
        name: "Visualforce",
        url: "https://developer.salesforce.com/docs/atlas.en-us.pages.meta/pages/pages_intro.htm",
      },
      {
        name: "Aura Components",
        url: "https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/intro_components.htm",
      },
      {
        name: "SLDS",
        url: "https://www.lightningdesignsystem.com/",
      },
      {
        name: "Vue.js",
        url: "https://vuejs.org/",
      },
      {
        name: "jQuery",
        url: "https://jquery.com/",
      },
      {
        name: "Svelte",
        url: "https://svelte.dev/",
      },
      {
        name: "Tailwind",
        url: "https://tailwindcss.com/",
      },
      {
        name: "HTML",
        url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
      },
      {
        name: "CSS",
        url: "https://developer.mozilla.org/en-US/docs/Web/CSS",
      },
      {
        name: "Foundation for Sites",
        url: "https://get.foundation/sites.html",
      },
      {
        name: "MJML",
        url: "https://mjml.io/",
      },
    ],
  },
  {
    name: "Architecture",
    skills: [
      {
        name: "Microservices",
        url: "https://martinfowler.com/articles/microservices.html",
      },
      {
        name: "Event-Driven Architecture",
      },
      {
        name: "System Design",
      },
      {
        name: "API Design",
      },
      {
        name: "Integration Architecture",
      },
      {
        name: "Observability",
      },
    ],
  },
  {
    name: "Identity & Security",
    skills: [
      {
        name: "Okta",
        url: "https://www.okta.com/",
      },
      {
        name: "Keycloak",
        url: "https://www.keycloak.org/",
      },
      {
        name: "OAuth2",
        url: "https://oauth.net/2/",
      },
      {
        name: "JWT",
        url: "https://www.jwt.io/",
      },
      {
        name: "SSO",
      },
      {
        name: "RBAC",
        url: "https://csrc.nist.gov/projects/role-based-access-control",
      },
      {
        name: "Access Reviews",
      },
    ],
  },
  {
    name: "Methodologies & Practices",
    skills: [
      {
        name: "Agile/Scrum",
      },
      {
        name: "Sprint planning",
      },
      {
        name: "Backlog refinement",
      },
      {
        name: "SDLC",
      },
      {
        name: "Code review",
      },
      {
        name: "Unit & integration testing",
      },
      {
        name: "Apex test classes",
      },
      {
        name: "CI/CD",
      },
      {
        name: "Release & sandbox management",
      },
      {
        name: "Root cause analysis (RCA)",
      },
      {
        name: "Incident response",
      },
      {
        name: "Secure coding (OWASP)",
        url: "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist",
      },
      {
        name: "Data modeling",
      },
      {
        name: "API design & versioning",
      },
      {
        name: "Technical documentation",
      },
    ],
  },
  {
    name: "Business Analysis & Process",
    skills: [
      {
        name: "Requirements elicitation",
      },
      {
        name: "Business process mapping & re-engineering",
      },
      {
        name: "Gap analysis",
      },
      {
        name: "User stories & acceptance criteria",
      },
      {
        name: "UAT planning",
      },
      {
        name: "Stakeholder management",
      },
      {
        name: "Workflow automation",
      },
      {
        name: "KPI definition",
      },
      {
        name: "Cost-benefit analysis",
      },
      {
        name: "Change management",
      },
      {
        name: "Vendor evaluation & management",
      },
      {
        name: "End-user training",
      },
    ],
  },
];

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
  {
    name: "Workato Foundations Level 1",
    id: "187474359",
    url: "https://academy.workato.com/workato-foundations-1",
  },
  {
    name: "Workato Foundations Level 2",
    id: "187476397",
    url: "https://academy.workato.com/workato-foundations-2",
  },
  {
    name: "Workato Enterprise AI Essentials",
    url: "https://academy.workato.com/learn/courses/251/workato-enterprise-ai-essentials",
  },
  {
    name: "Introduction to Workato Agent Studio",
    url: "https://academy.workato.com/learn/courses/41/introduction-to-workato-agent-studio",
  },
  {
    name: "Introduction to Enterprise MCP",
    url: "https://academy.workato.com/learn/courses/207/introduction-to-enterprise-mcp",
  },
];

export const jobs: Job[] = [
  {
    company: "Independent School Management",
    companyUrl: "https://isminc.com/",
    companyLocation: "Wilmington, DE",
    start: "2022-08",
    end: "2026-05",
    viaEmployer: {
      name: "Turnberry Solutions",
      start: "2022-08",
      end: "2023-01",
      engagement: "contract-to-hire",
    },
    description:
      "EdTech SaaS provider of school management software, strategy, and consulting for private and independent schools.",
    roleLocation: "Remote",
    position: "Senior Software Engineer, Full-Stack/Integrations/Data/Salesforce",
    roles: [
      {
        title: "Senior Software Engineer, Full-Stack/Integrations/Data/Salesforce",
        start: "2024",
        end: "2026",
      },
      {
        title: "Integration/Data Engineer, Salesforce Developer",
        start: "2023",
        end: "2024",
      },
      {
        title: "Backend Developer, Salesforce Developer, Integration Engineer",
        start: "2022",
        end: "2023",
      },
    ],
    highlights: [
      {
        id: "ism-workato-redesign",
        summary:
          "Cut Workato billable usage by 98% and integration failures by 89%, avoiding roughly $850K in projected annual overage costs, by redesigning the enterprise integration architecture behind business-critical workflows following a usage audit and cost-benefit analysis presented to leadership.",
        specifics: [
          {
            detail:
              "Delivered with no loss of existing integration automation functionality, and while adding new integrations.",
          },
          {
            detail:
              "Prior projections placed Workato task usage at ~112,000,000 tasks per year. Post-optimization actual usage was ~1,500,000 per year.",
          },
          {
            detail:
              "Errors requiring review and intervention fell from ~4,800 to ~500 per year (excluding soft-fails, outages, and automated retries).",
          },
          {
            detail:
              "Optimizations followed a per-process analysis and covered: converting scheduled automations to event-based, converting event-based automations to scheduled, bulk processing optimizations, custom REST endpoint processing, Python data processing, system trigger changes, and schedule requirement audits.",
          },
        ],
      },
      {
        id: "ism-workato-connector",
        summary:
          "Built and maintained a custom Workato connector using the Workato Developer SDK for the company documentation platform, which had no out-of-the-box connector available.",
        specifics: [
          {
            detail:
              "Additionally assisted in troubleshooting other custom connectors (such as Sage Intacct) made by a third party when issues ocurred.",
          },
        ],
      },
      {
        id: "ism-observability",
        summary:
          "Reduced incident detection time 90% by designing and deploying centralized monitoring, alerting, and observability tooling across 100+ integrations spanning 10+ SaaS and internal systems (including Stripe for multiple payment processes), feeding incident response and post-incident root cause analysis (RCA).",
        specifics: [
          {
            detail:
              "All successes and errors were logged to a centralized database, along with an XML, JSON, or plain-text stack trace, and automatically mapped via a centralized process inventory. The design was platform-agnostic and enabled real-time error notifications, automatic ticket creation for actionable errors, and broader reporting.",
          },
          {
            detail:
              "Overall integration health was assessed through a dashboard and reporting tool covering integration usage, error frequency, and underuse and overuse warnings — reported per platform, per group of platforms, and per individual integration process.",
          },
        ],
      },
      {
        id: "ism-worker-queues",
        summary:
          "Architected fault-tolerant, bidirectional integrations and scalable worker-queue processes for a web-based multi-tenant SaaS platform, supporting real-time events, scheduled bulk jobs, idempotent retry logic, and standardized error handling and logging.",
        specifics: [
          {
            detail:
              "Implemented a worker queue system backed by PostgreSQL, built with C# and Entity Framework Core (EF Core).",
          },
          {
            detail:
              "Used the worker queue system for scaling, job error tracking, job retries, safe webhook and event processing, scheduled processes, and debouncing.",
          },
        ],
      },
      {
        id: "ism-saas-features",
        summary:
          "Designed and maintained SaaS platform features for document management, communications, tax verification, and reporting, improving reliability and usability for customer-facing workflows.",
        specifics: [
          {
            detail:
              "Created and iterated on front-end and back-end customer-facing data reporting functionality.",
          },
          {
            detail:
              "Worked on the team that developed the notification system, building the templating engine, template versioning and deployment, and front-end components, and collaborating on the back-end.",
          },
          {
            detail:
              "Designed and built multiple iterations of the tax verification system, integrating front end and back end with several third parties.",
          },
          {
            detail: "Built a system for customers to generate and cache PDF documents on demand.",
          },
          {
            detail:
              "Redesigned a production data structure to correct a significant oversight in the original third-party design.",
          },
        ],
      },
      {
        id: "ism-lakehouse",
        summary:
          "Co-designed and implemented a Databricks Lakehouse platform consolidating data from 10+ business systems via Fivetran, Lakeflow Connect, and custom Python ETL pipelines, including data model design for analytics and reporting.",
        specifics: [
          {
            detail: "Built data ingestion pipelines using Fivetran.",
          },
          {
            detail:
              "Built part of the Databricks Asset Bundle used to define and process the migration of data between the landing zone, bronze layer, CDC layer, silver layer, and gold layers, as well as the CI/CD process used to deploy the bundle to the applicable Databricks environment.",
          },
          {
            detail:
              "Acted as subject matter expert for several of the source platforms, and for how their data was intended to relate and move between systems.",
          },
        ],
      },
      {
        id: "ism-data-quality",
        summary:
          "Built PySpark and SQL-based validation, transformation, data quality monitoring, reverse ETL, and self-service analytics workflows, improving data reliability and accessibility for business users.",
        specifics: [
          {
            detail:
              "Designed and built multiple data quality and integration audit pipelines, designed to identify and surface discrepancies between systems and data sets.",
          },
          {
            detail:
              "Designed and built a declarative reverse ETL process used to define reverse ETL jobs via YAML inside the Databricks Asset Bundles, which was reused to push data from gold reverse ETL tables into Salesforce.",
          },
        ],
      },
      {
        id: "ism-salesforce-dev",
        summary:
          "Built Salesforce customizations with Apex (including unit test coverage), Lightning Web Components, Flows, custom objects, validation rules, and platform integrations powering business-critical workflows and data synchronization; supported sandbox and release management through SFDX-based deployment pipelines.",
        specifics: [
          {
            detail:
              "Built custom REST endpoints to receive and process inbound integration payloads.",
          },
          {
            detail:
              "Created multiple triggers to process integration inventory and log data, and to generate integration reports.",
          },
          {
            detail:
              "Created invocable Apex enabling Flows to trigger remote API functions directly, including repeating Workato jobs, submitting DocuSign envelopes, creating Jira issues, and running company SaaS features.",
          },
          {
            detail: "Created a Lightning Web Component for managing custom Account index tables.",
          },
        ],
      },
      {
        id: "ism-requirements",
        summary:
          "Led requirements-gathering and discovery sessions with Product and business stakeholders across multiple time zones, translating business needs into user stories, acceptance criteria, and phased MVP scope that accelerated delivery and prioritized follow-on iterations within an Agile process.",
        specifics: [],
      },
      {
        id: "ism-production-issues",
        summary:
          "Diagnosed and resolved complex production issues across custom applications, integrations, and Salesforce environments using code analysis, monitoring data, and root cause analysis.",
        specifics: [],
      },
      {
        id: "ism-code-review",
        summary:
          "Reviewed code and mentored engineers on integration patterns, unit and integration testing standards, and Salesforce development best practices.",
        specifics: [],
      },
      {
        id: "ism-interim-admin",
        summary:
          "Served as interim/backup Salesforce Administrator while the primary administrator was away (short or extended periods), handling user administration, profiles and permission sets, reports and dashboards, Flow automation, and day-to-day configuration and support requests for users across multiple departments.",
        specifics: [],
      },
      {
        id: "ism-security",
        summary:
          "Shaped security policy, penetration test remediation, secure coding practices, and recurring access reviews as a member of the company security team.",
        specifics: [],
      },
      {
        id: "ism-documentation",
        summary:
          "Launched and governed a company-wide documentation platform, standardizing business and technical process documentation and reducing operational dependency on tribal knowledge.",
        specifics: [
          {
            detail:
              "Designed RBAC structure for documentation platform, and defined initial permission structure.",
          },
          {
            detail: "Wrote documentation on best practices for the documentation platform.",
          },
          {
            detail: "Provided 1 on 1 training for all documentation managers.",
          },
          {
            detail:
              "Provided as-needed group training for all documentation users and contributors.",
          },
          {
            detail:
              "Wrote extensive development process documentation for Salesforce development, Integration development, as well as company SaaS platform development.",
          },
        ],
      },
    ],
  },
  {
    company: "Bespoke Collection",
    companyLocation: "Napa, CA",
    start: "2013-10",
    end: "2022-08",
    description:
      "Former parent group of Blackbird Vineyards and Aerena Galleries & Gardens — DTC wine and fine art brands",
    roleLocation: "Hybrid",
    position: "Software & Systems Integration Lead",
    roles: [
      {
        title: "Software & Systems Integration Lead",
        start: "2019",
        end: "2022",
      },
      {
        title: "Salesforce Admin/Developer & Integration Engineer",
        start: "2014",
        end: "2019",
      },
      {
        title: "Web Developer",
        start: "2013",
        end: "2014",
      },
    ],
    highlights: [
      {
        id: "bespoke-integration-strategy",
        summary:
          "Owned development and systems integration strategy across multiple brands and six physical locations, supporting day-to-day business operations and executive-level analytics needs.",
        specifics: [],
      },
      {
        id: "bespoke-ecommerce",
        summary:
          "Designed and built a headless eCommerce platform serving 60,000+ customers across multiple brands, with Salesforce as the system of record for customer, pricing, rewards, and product data, enabling personalized pricing, rewards programs, and cross-brand commerce.",
        specifics: [],
      },
      {
        id: "bespoke-pos",
        summary:
          "Built an LWC-based point-of-sale (POS) system in Salesforce with modular components and third-party payment terminal integration for retail locations.",
        specifics: [],
      },
      {
        id: "bespoke-cart-hold",
        summary:
          "Engineered a time-limited cart hold and inventory reservation system enabling online sales of one-of-a-kind artwork by temporarily locking held items to prevent duplicate purchases.",
        specifics: [],
      },
      {
        id: "bespoke-integrations",
        summary:
          "Built and evolved custom integrations across Salesforce, eCommerce, point-of-sale, shipping, marketing, payment processing (Authorize.net), and compliance systems, improving reliability and reducing manual work across DTC and wholesale operations.",
        specifics: [],
      },
      {
        id: "bespoke-salesforce-admin",
        summary:
          "Owned Salesforce administration and development company-wide, including user access and permissions (RBAC), workflow automation, data quality, data model design, reporting, configuration, and end-user training and support.",
        specifics: [],
      },
      {
        id: "bespoke-cicd",
        summary:
          "Developed CI/CD automation and Salesforce migration tooling using Apex, Python, REST APIs, Salesforce CLI, and Ant Migration Tool, including sandbox and release management for heavily customized multi-brand environments.",
        specifics: [],
      },
      {
        id: "bespoke-salesforce-apps",
        summary:
          "Partnered with executives and business stakeholders to map existing business processes, identify gaps, and design Salesforce applications for inventory tracking, financial reporting, commissions, consignment, and reservations, improving operational visibility across brands.",
        specifics: [],
      },
      {
        id: "bespoke-vendor-management",
        summary:
          "Negotiated technology vendor contracts and services, led vendor evaluations, managed SaaS licenses, and maintained department budgets and forecasts.",
        specifics: [],
      },
      {
        id: "bespoke-store-locator",
        summary:
          "Built consumer-facing store locator functionality, combining wholesale distribution data with manually curated refinements.",
        specifics: [],
      },
    ],
  },
  {
    company: "Self-employed",
    companyLocation: "San Francisco Bay Area",
    start: "2009-01",
    end: null,
    description: "Independent web development practice.",
    roleLocation: "Hybrid",
    position: "Freelance Web Developer",
    roles: [
      {
        title: "Freelance Web Developer",
        start: "2009",
        end: null,
      },
    ],
    highlights: [
      {
        id: "freelance-wordpress-plugins",
        summary: "Built custom WordPress plugins for client sites.",
        specifics: [
          {
            detail:
              "Integration plugins, used to collect and validate data and create leads in external systems.",
          },
          {
            detail: "Content plugins, used to create and display custom content types.",
          },
          {
            detail:
              "Set up and configured third-party WordPress plugins, external services, and mailing lists.",
          },
          {
            detail: "Fine-tuned on-page SEO and the supporting content strategy.",
          },
          {
            detail: "Migrated static websites to WordPress for CMS.",
          },
        ],
      },
      {
        id: "freelance-design-to-site",
        summary: "Built working websites from provided design files.",
        specifics: [],
      },
      {
        id: "freelance-data-engineering",
        summary: "Ad-hoc data migrations and data analysis",
        specifics: [
          {
            detail:
              "Created one-off data migration scripts mapping old data sources to new systems (e.g. customers from legacy CRM to new eCommerce and Marketing platforms.",
          },
          {
            detail:
              "Spun up VPS to host Postgres and Redeash (configured with SSO), then loaded legacy CRM data into dedicated Postgres database, created template reports in Redash for users to self-service data exports and legacy data research (till final sunset date).",
          },
        ],
      },
    ],
  },
  {
    company: "The QB Specialists",
    companyLocation: "San Francisco Bay Area",
    start: "2008-06",
    end: "2012-06",
    description: "QuickBooks consulting and accounting systems support.",
    roleLocation: "Hybrid",
    position: "QuickBooks Pro Advisor",
    roles: [
      {
        title: "QuickBooks Pro Advisor",
        start: "2008",
        end: "2012",
      },
    ],
    highlights: [
      {
        id: "qb-bookkeeping",
        summary:
          "Performed bookkeeping and financial data entry, troubleshot QuickBooks reporting issues, and set up and configured QuickBooks Enterprise for networked multi-user environments.",
        specifics: [],
      },
    ],
  },
];

export const education: Education[] = [
  {
    credential: "General Educational Development (GED) Diploma",
  },
];

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
