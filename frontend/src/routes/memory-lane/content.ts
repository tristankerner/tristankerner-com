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
    id: "1997-the-beginning",
    date: "1997-01-01",
    title: "Where It Started",
    slides: [
      {
        text: "It's hard to pin down the real start. These were the days of 75mhz CPUs, dial-up modems, where AOL accounts were literally everywhere--and each account had the ability to make their own homepage. You just needed to learn some <blink>HTML</blink>.",
      },
      { text: "Plus a collection of animated gifs also wouldn't hurt." },
    ],
  },
  {
    id: "2000-first-languages",
    date: "2000-01-01",
    title: "Early-ish Web",
    slides: [
      {
        text: "Nothing was more interesting that how the internet and websites actually worked. This was a time of Apache, ye' old cgi-bin, Perl (my first actual language), CSS, and Javascript.",
        // image: { src: memoryPlaceholder, alt: "Placeholder photo — swap for a real one" },
      },
      {
        text: "Cygwin deserves on honorable mention--a 900 page book on Perl didn't get you very far on an IBM ThinkPad with Windows on it. It would be a long time before WSL."
      },
      {
        text: "Oh, and cable internet of course. Nothing opens up a world of possibilities like high speed internet. I registered my first domain this year, and it's still kept current through today."
      }
    ],
  },
  {
    id: "2004-newer-web-development",
    date: "2004-07-01",
    title: "Newer Options",
    slides: [
      { text: "PHP 5 was released, and from my young person's view, Perl was no longer the best option around. A time where WordPress & phpBB dominated. Here I learned MySql, and toyed with moving from Apache to Nginx." },
    ],
  },{
    id: "2007-jquery",
    date: "2006-06-01",
    title: "jQuery",
    slides: [
      { text: "jQuery deserves a mention--it made so many pieces of working with Javascript and DOM easier, though I can't say for sure that this was the moment I first encountered it." },
      { text: "I did a few odds and ends for folks around now. Websites for family members. Personal websites that never took off." },
    ],
  },
  {
    id: "2008-first-job",
    date: "2008-06-01",
    title: "QuickBooks Pro Advisor",
    slides: [
        { text: "Here I started working--bookkeeping and technical support for QuickBooks. My first job taught me a lot, as did my first manager, co-workers, and clients." },
        { text: "This as a career wasn't meant to be, and I found myself doing more IT than accounting, and even some development work focusing on WordPress features/plugins." },
        { text: "My first integration took place here. WordPress collected data to Intuit QuickBase." }
    ],
  },
  {
    id: "2009-freelance",
    date: "2009-06-01",
    title: "Freelance",
    slides: [
      { text: "Here I began focusing on freelance web development. Some design, when needed, but primarily backend and admin work." },
      { text: "I expect this would have gone much longer, if I were a better salesman and networker." }
    ],
  },
  {
    id: "2013-bespoke-collection",
    date: "2013-12-01",
    title: "A Bespoke Blackbird in an Aerena",
    slides: [
        { text: "I found a local company that wanted a full-time developer. They asked if I could get familiar with Salesforce too..." },
        { text: "So I did. I worked on their website, learned Salesforce Administration from their admin & learned Development from documentation." },
        { text: "Years were spent here, building and scaling features and new websites. Learning new frameworks (Vue.js, Foundation, Bootstrap)... Integrating so many systems--REST and SOAP, real time and scheduled. Inside Salesforce and out."},
        { text: "I rarely even missed a Salesforce Release Readiness webinar."},
    ],
  },
  {
    id: "2022-ISM",
    date: "2022-08-08",
    title: "Integrate-ism",
    slides: [
      { text: "The time had come to move on, and a company called Turnberry said they needed and integration engineer for a place called Independent School Management--but I would have to learn an IPaaS system called Workato." },
      { text: "The team there was great to work with, and while I overhauled their system of integrations, I was also given the opportunity to learn new things." },
      { text: "Data Engineering for Databricks, Software Engineering with C#/React/Tailwind. Here I found how easily the skills I had honed over the years combined to work in any set of systems, and any stack."},
    ],
  },
  {
    id: "2026-where-to",
    date: "2026-05-26",
    title: "Where To",
    slides: [
      { text: "Layoffs. It can happen to almost anyone, but this was the first time happening to me. Now I spend my time submitting applications, talking to recruiters, and trying to find what's next." },
      { text: "It did bring about this silly page." },
    ],
  },
];
