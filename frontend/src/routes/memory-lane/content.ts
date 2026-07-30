import type { MemorySlide } from "$lib/memory-lane/types";
import blinkTag from "$lib/assets/memory-lane/1997-blink-tag.svg";
import animatedGifs from "$lib/assets/memory-lane/1997-animated-gifs.svg";
import perlTerminal from "$lib/assets/memory-lane/2000-perl-terminal.svg";
import perlBookThinkpad from "$lib/assets/memory-lane/2000-perl-book-thinkpad.svg";
import cableSpeed from "$lib/assets/memory-lane/2000-cable-speed.svg";
import phpElephant from "$lib/assets/memory-lane/2004-php-elephant.svg";
import jqueryHug from "$lib/assets/memory-lane/2006-jquery-hug.svg";
import underConstruction from "$lib/assets/memory-lane/2006-under-construction.svg";
import quickbooksDesk from "$lib/assets/memory-lane/2008-quickbooks-desk.svg";
import wrenchWordpress from "$lib/assets/memory-lane/2008-wrench-wordpress.svg";
import wpQuickbaseIntegration from "$lib/assets/memory-lane/2008-wp-quickbase-integration.svg";
import freelanceLaptop from "$lib/assets/memory-lane/2009-freelance-laptop.svg";
import networkingMiss from "$lib/assets/memory-lane/2009-networking-miss.svg";
import cloudBlackbird from "$lib/assets/memory-lane/2013-cloud-blackbird.svg";
import cloudGraduation from "$lib/assets/memory-lane/2013-cloud-graduation.svg";
import integrationNetwork from "$lib/assets/memory-lane/2013-integration-network.svg";
import releaseReadiness from "$lib/assets/memory-lane/2013-release-readiness.svg";
import workatoPuzzle from "$lib/assets/memory-lane/2022-workato-puzzle.svg";
import teamGears from "$lib/assets/memory-lane/2022-team-gears.svg";
import swissArmyToolbox from "$lib/assets/memory-lane/2022-swiss-army-toolbox.svg";
import compassDoor from "$lib/assets/memory-lane/2026-compass-door.svg";
import sillyPage from "$lib/assets/memory-lane/2026-silly-page.svg";

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

export const memories: MemoryEntry[] = [
  {
    id: "1997-the-beginning",
    date: "1997-01-01",
    title: "Where It Started",
    slides: [
      {
        text: "It's hard to pin down the real start. These were the days of 75mhz CPUs, dial-up modems, where AOL accounts were literally everywhere--and each account had the ability to make their own homepage. You just needed to learn some <blink>HTML</blink>.",
        image: { src: blinkTag, alt: "A CRT monitor glowing with a blinking <blink> tag, tethered to a phone by a curly modem cord" },
      },
      {
        text: "Plus a collection of animated gifs also wouldn't hurt.",
        image: { src: animatedGifs, alt: "A pixelated stick figure dancing in a loop, surrounded by sparkle stars" },
      },
    ],
  },
  {
    id: "2000-first-languages",
    date: "2000-01-01",
    title: "Early-ish Web",
    slides: [
      {
        text: "Nothing was more interesting that how the internet and websites actually worked. This was a time of Apache, ye' old cgi-bin, Perl (my first actual language), CSS, and Javascript.",
        image: { src: perlTerminal, alt: "A terminal running a Perl shebang line, with a small camel standing on top" },
      },
      {
        text: "Cygwin deserves on honorable mention--a 900 page book on Perl didn't get you very far on an IBM ThinkPad with Windows on it. It would be a long time before WSL.",
        image: { src: perlBookThinkpad, alt: "A towering 900 page Perl book squashing a small ThinkPad laptop, which sprouts a sweat drop" },
      },
      {
        text: "Oh, and cable internet of course. Nothing opens up a world of possibilities like high speed internet. I registered my first domain this year, and it's still kept current through today.",
        image: { src: cableSpeed, alt: "A speedometer needle pinned to fast, next to a network cable plug and a small globe" },
      },
    ],
  },
  {
    id: "2004-newer-web-development",
    date: "2004-07-01",
    title: "Newer Options",
    slides: [
      {
        text: "PHP 5 was released, and from my young person's view, Perl was no longer the best option around. A time where WordPress & phpBB dominated. Here I learned MySql, and toyed with moving from Apache to Nginx.",
        image: { src: phpElephant, alt: "A small elephant in a party hat labeled five, beside a blog W icon, a phpBB speech bubble, and a MySQL cylinder" },
      },
    ],
  },
  {
    id: "2007-jquery",
    date: "2006-06-01",
    title: "jQuery",
    slides: [
      {
        text: "jQuery deserves a mention--it made so many pieces of working with Javascript and DOM easier, though I can't say for sure that this was the moment I first encountered it.",
        image: { src: jqueryHug, alt: "A big friendly dollar sign wrapping its arms around a small DOM element box in a hug" },
      },
      {
        text: "I did a few odds and ends for folks around now. Websites for family members. Personal websites that never took off.",
        image: { src: underConstruction, alt: "A leaning under construction sign with a tumbleweed rolling past and a cobweb in the corner" },
      },
    ],
  },
  {
    id: "2008-first-job",
    date: "2008-06-01",
    title: "QuickBooks Pro Advisor",
    slides: [
      {
        text: "Here I started working--bookkeeping and technical support for QuickBooks. My first job taught me a lot, as did my first manager, co-workers, and clients.",
        image: { src: quickbooksDesk, alt: "A ledger book, a calculator, and a headset stacked on a desk, with a big Q logo watching over them" },
      },
      {
        text: "This as a career wasn't meant to be, and I found myself doing more IT than accounting, and even some development work focusing on WordPress features/plugins.",
        image: { src: wrenchWordpress, alt: "A wrench crossed over a WordPress style gear, next to an open toolbox" },
      },
      {
        text: "My first integration took place here. WordPress collected data to Intuit QuickBase.",
        image: { src: wpQuickbaseIntegration, alt: "A box labeled WP connected by a dashed arrow of flowing data particles to a box labeled QB" },
      },
    ],
  },
  {
    id: "2009-freelance",
    date: "2009-06-01",
    title: "Freelance",
    slides: [
      {
        text: "Here I began focusing on freelance web development. Some design, when needed, but primarily backend and admin work.",
        image: { src: freelanceLaptop, alt: "A laptop with gears turning on its screen for backend work, next to a freelancer briefcase" },
      },
      {
        text: "I expect this would have gone much longer, if I were a better salesman and networker.",
        image: { src: networkingMiss, alt: "Two hands reaching for a handshake but just missing each other, with a question mark speech bubble" },
      },
    ],
  },
  {
    id: "2013-bespoke-collection",
    date: "2013-12-01",
    title: "A Bespoke Blackbird in an Aerena",
    slides: [
      {
        text: "I found a local company that wanted a full-time developer. They asked if I could get familiar with Salesforce too...",
        image: { src: cloudBlackbird, alt: "A soft cloud with a gear inside and a small blackbird perched on top, with a sunrise behind" },
      },
      {
        text: "So I did. I worked on their website, learned Salesforce Administration from their admin & learned Development from documentation.",
        image: { src: cloudGraduation, alt: "A cloud wearing a graduation cap, with an admin badge pinned beside it" },
      },
      {
        text: "Years were spent here, building and scaling features and new websites. Learning new frameworks (Vue.js, Foundation, Bootstrap)... Integrating so many systems--REST and SOAP, real time and scheduled. Inside Salesforce and out.",
        image: { src: integrationNetwork, alt: "A web of connected plug nodes labeled REST and SOAP spinning around a clock face" },
      },
      {
        text: "I rarely even missed a Salesforce Release Readiness webinar.",
        image: { src: releaseReadiness, alt: "A calendar beside a webinar screen playing a cloud logo, with a perfect unbroken row of checkmarks" },
      },
    ],
  },
  {
    id: "2022-ISM",
    date: "2022-08-08",
    title: "Integrate-ism",
    slides: [
      {
        text: "The time had come to move on, and a company called Turnberry said they needed and integration engineer for a place called Independent School Management--but I would have to learn an IPaaS system called Workato.",
        image: { src: workatoPuzzle, alt: "Puzzle pieces interlocking around a plug labeled with an API tag" },
      },
      {
        text: "The team there was great to work with, and while I overhauled their system of integrations, I was also given the opportunity to learn new things.",
        image: { src: teamGears, alt: "Three interlocking gears of different colors turning smoothly together, with a small thumbs up" },
      },
      {
        text: "Data Engineering for Databricks, Software Engineering with C#/React/Tailwind. Here I found how easily the skills I had honed over the years combined to work in any set of systems, and any stack.",
        image: { src: swissArmyToolbox, alt: "An open toolbox fanning out a data diamond, a React atom, a Tailwind ribbon, and C# curly braces" },
      },
    ],
  },
  {
    id: "2026-where-to",
    date: "2026-05-26",
    title: "Where To",
    slides: [
      {
        text: "Layoffs. It can happen to almost anyone, but this was the first time happening to me. Now I spend my time submitting applications, talking to recruiters, and trying to find what's next.",
        image: { src: compassDoor, alt: "A door standing ajar with warm light spilling through, and a compass beside it pointing forward" },
      },
      {
        text: "It did bring about this silly page.",
        image: { src: sillyPage, alt: "A winking browser window with a little heart in its address bar, surrounded by playful confetti" },
      },
    ],
  },
];
