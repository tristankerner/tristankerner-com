---
title: "A Parade of Horrible SVGs"
author: "Tristan Kerner"
excerpt: "Walking into uncanny valley on purpose..."
---

I had a few goals for this website:

1. Create a personal site/landing zone while I job hunt. It also makes my personal email address a little less odd, for those curious individuals who check.
2. Crash course everything AI for development.
3. A place to put any eventual open-source portfolio that I may (or may not) put together.

To achieve this, I set a somewhat strict requirement on myself for this page. **Make it architecturally
interesting to me while only letting AI write most of the code.** This worked fine. There was a learning curve, and there
might be bugs that I just haven't looked too deeply into. I even had it do the UI--it's not the fanciest, but it's
probably better than what I (someone who is definitely not a graphic designer) could have quickly come up with.

Here's where things went wrong...or Mystery Science Theater 3000 levels of right, depending on your point of view.

I asked Claude:

`@frontend/src/routes/memory-lane/content.ts in this file, and do your best to find or create an svg image to go along with the text in the slide. If possible, the image/icon should be amusing and almost conversational with the text written.`

[Results on Memory Ln](/memory-lane)

I could certainly have included more detail, or requested the images slide by slide. I could even have requested specific
imagery per slide. Maybe the SVG format restriction played a part. I could have even just asked to try again. To be
fair, some of the images aren't actually that horrible. In the end, though, it was my choice to keep them, and share my
short walk into the uncanny valley with some very small subset of the world. There's a lesson there, though I know that
lesson may change as AI improves every day, and as we add loops and tools and agents upon agents. Instead of articulating
that, I'll just leave you with the headliner:

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="A winking browser window with a little heart in its address bar, surrounded by playful confetti, a self aware nod to this silly page">
  <rect width="400" height="300" fill="#2c4454" />
  <g transform="translate(90,60)">
    <rect x="0" y="0" width="220" height="160" rx="8" fill="#0d1a20" stroke="#3f5c6c" stroke-width="4" />
    <rect x="0" y="0" width="220" height="30" rx="8" fill="#3f5c6c" />
    <circle cx="18" cy="15" r="5" fill="#d9704f" /><circle cx="36" cy="15" r="5" fill="#e8a33d" /><circle cx="54" cy="15" r="5" fill="#5ad66d" />
    <!-- winking face made of DOM bits -->
    <circle cx="75" cy="90" r="6" fill="#6fb3d9" />
    <path d="M130 84 q10 8 20 0" stroke="#6fb3d9" stroke-width="4" fill="none" stroke-linecap="round" />
    <path d="M95 115 q20 20 45 0" stroke="#e8a33d" stroke-width="5" fill="none" stroke-linecap="round" />
    <path d="M60 60 C 55 52 44 60 60 74 C 76 60 65 52 60 60 Z" fill="#d9704f" />
  </g>
  <!-- confetti -->
  <g>
    <rect x="40" y="60" width="8" height="8" fill="#c76b9c" transform="rotate(20 44 64)" />
    <rect x="340" y="90" width="8" height="8" fill="#5ad66d" transform="rotate(-15 344 94)" />
    <circle cx="330" cy="200" r="5" fill="#e8a33d" />
    <circle cx="55" cy="220" r="5" fill="#6fb3d9" />
    <rect x="360" y="150" width="6" height="6" fill="#d9704f" />
  </g>
</svg>
