---
title: "Feature Creepin'"
author: "Tristan Kerner"
excerpt: "I unknowingly started a new personal project..."
---

I unknowingly started a new personal project recently. It turned into an interesting lesson in feature creep for the AI
age... Though, that lesson may only apply to personal projects when you happen to need a distraction.

TLDR: [resume-cv-mcp-api](https://github.com/tristankerner/resume-cv-mcp-api) and [resume-cv-mcp-api-web-client](https://github.com/tristankerner/resume-cv-mcp-api-web-client)   should be flipped to public soon<sup>*tm*</sup>.  

So, what is the project, and how far did it creep?

This project started as a centralized document repository (with versioning) for my personal master résumé, so that it 
could feed this site, as well as my LLM of choice to conduct fine-tuning operations and generate docx versions...

- Once I had a centralized document repository, I thought that it would be so much more useful if I could include 
additional information that wasn't available in the public feed.
- So, I added public vs private data.
- Now that there's public/private data, I need to add authentication.
- If you're doing authentication, you might as well do Users. After all, maybe someone I know would want to use this too.
- Better have MFA and some sort of recovery option too, that's just table-stakes these days. 
- Now that we have authentication, you really should have MCP tooling.
- MCP tooling really benefits from specific authentication methods (oAuth 2.1). 
- If we have proper MCP tools, and proper MCP auth, wouldn't it be nice to centralize additional résumé metadata and 
skill information, so that you can easily fine-tune your résumé and cover letter from any device.
- Better make sure that each user can have multiple versions of each document though. I don't remember why, and I can't
think of a great reason now, but it seemed important at the time.
- Flat files aren't great though, and this has all been API-first. Adding a web-based client should be easy enough,
with the specs all built out.
- Well now, this just seems to be working great. What more could I need. **stares intently at my application tracking
gsheet**. I suppose a little sprinkle of CRM couldn't hurt...

I was never trying to fully automate the application process... I still want to know where I'm applying to, assess 
whether I feel it would be a good fit, etc. I just don't want to spend hours a day managing documents, version 
controlling them, making sure an LLM has access, making sure I update the website, etc. 

There's certainly a better/easier way to do this, but I thought this would be fun, and a little useful. It definitely
got away from me, I kinda feel like that's the 
interesting part though... Many of the areas where I would normally say "No, that's too much for a personal project this 
size, for this purpose", I just went ahead and had Claude do it. Repeat. I tried to enforce some code standards, and do
some automated cleanup on that front. I have other thoughts for future changes, though I should probably move on to
more productive endeavors.

I'm not going to lie--I'm behind on doing a thorough code review.


<svg width="100" height="100" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 122.88 122.25" style="enable-background:new 0 0 122.88 122.25" xml:space="preserve">
<g>
<path stroke="currentColor" fill="currentColor" d="M101.77,49.38c2.09,3.1,4.37,5.11,6.86,5.78c2.45,0.66,5.32,0.06,8.7-2.01c1.36-0.84,3.14-0.41,3.97,0.95 c0.28,0.46,0.42,0.96,0.43,1.47c0.13,1.4,0.21,2.82,0.24,4.26c0.03,1.46,0.02,2.91-0.05,4.35h0v0c0,0.13-0.01,0.26-0.03,0.38 c-0.91,16.72-8.47,31.51-20,41.93c-11.55,10.44-27.06,16.49-43.82,15.69v0.01h0c-0.13,0-0.26-0.01-0.38-0.03 c-16.72-0.91-31.51-8.47-41.93-20C5.31,90.61-0.73,75.1,0.07,58.34H0.07v0c0-0.13,0.01-0.26,0.03-0.38 C1,41.22,8.81,26.35,20.57,15.87C32.34,5.37,48.09-0.73,64.85,0.07V0.07h0c1.6,0,2.89,1.29,2.89,2.89c0,0.4-0.08,0.78-0.23,1.12 c-1.17,3.81-1.25,7.34-0.27,10.14c0.89,2.54,2.7,4.51,5.41,5.52c1.44,0.54,2.2,2.1,1.74,3.55l0.01,0 c-1.83,5.89-1.87,11.08-0.52,15.26c0.82,2.53,2.14,4.69,3.88,6.4c1.74,1.72,3.9,3,6.39,3.78c4.04,1.26,8.94,1.18,14.31-0.55 C99.73,47.78,101.08,48.3,101.77,49.38L101.77,49.38z M59.28,57.86c2.77,0,5.01,2.24,5.01,5.01c0,2.77-2.24,5.01-5.01,5.01 c-2.77,0-5.01-2.24-5.01-5.01C54.27,60.1,56.52,57.86,59.28,57.86L59.28,57.86z M37.56,78.49c3.37,0,6.11,2.73,6.11,6.11 s-2.73,6.11-6.11,6.11s-6.11-2.73-6.11-6.11S34.18,78.49,37.56,78.49L37.56,78.49z M50.72,31.75c2.65,0,4.79,2.14,4.79,4.79 c0,2.65-2.14,4.79-4.79,4.79c-2.65,0-4.79-2.14-4.79-4.79C45.93,33.89,48.08,31.75,50.72,31.75L50.72,31.75z M119.3,32.4 c1.98,0,3.58,1.6,3.58,3.58c0,1.98-1.6,3.58-3.58,3.58s-3.58-1.6-3.58-3.58C115.71,34.01,117.32,32.4,119.3,32.4L119.3,32.4z M93.62,22.91c2.98,0,5.39,2.41,5.39,5.39c0,2.98-2.41,5.39-5.39,5.39c-2.98,0-5.39-2.41-5.39-5.39 C88.23,25.33,90.64,22.91,93.62,22.91L93.62,22.91z M97.79,0.59c3.19,0,5.78,2.59,5.78,5.78c0,3.19-2.59,5.78-5.78,5.78 c-3.19,0-5.78-2.59-5.78-5.78C92.02,3.17,94.6,0.59,97.79,0.59L97.79,0.59z M76.73,80.63c4.43,0,8.03,3.59,8.03,8.03 c0,4.43-3.59,8.03-8.03,8.03s-8.03-3.59-8.03-8.03C68.7,84.22,72.29,80.63,76.73,80.63L76.73,80.63z M31.91,46.78 c4.8,0,8.69,3.89,8.69,8.69c0,4.8-3.89,8.69-8.69,8.69s-8.69-3.89-8.69-8.69C23.22,50.68,27.11,46.78,31.91,46.78L31.91,46.78z M107.13,60.74c-3.39-0.91-6.35-3.14-8.95-6.48c-5.78,1.52-11.16,1.41-15.76-0.02c-3.37-1.05-6.32-2.81-8.71-5.18 c-2.39-2.37-4.21-5.32-5.32-8.75c-1.51-4.66-1.69-10.2-0.18-16.32c-3.1-1.8-5.25-4.53-6.42-7.88c-1.06-3.05-1.28-6.59-0.61-10.35 C47.27,5.95,34.3,11.36,24.41,20.18C13.74,29.69,6.66,43.15,5.84,58.29l0,0.05v0h0l-0.01,0.13v0C5.07,73.72,10.55,87.82,20.02,98.3 c9.44,10.44,22.84,17.29,38,18.1l0.05,0h0v0l0.13,0.01h0c15.24,0.77,29.35-4.71,39.83-14.19c10.44-9.44,17.29-22.84,18.1-38l0-0.05 v0h0l0.01-0.13v0c0.07-1.34,0.09-2.64,0.06-3.91C112.98,61.34,109.96,61.51,107.13,60.74L107.13,60.74z M116.15,64.04L116.15,64.04 L116.15,64.04L116.15,64.04z M58.21,116.42L58.21,116.42L58.21,116.42L58.21,116.42z"/>
</g>
</svg>
<svg width="200" height="200" viewBox="0 0 500 500" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M372.498 183.912C354.33 187.703 338.349 200.694 316.631 229.321C302.183 248.367 289.442 261.731 285.731 261.731C284.418 261.731 281.765 258.678 279.838 254.945C273.972 243.589 258.317 227.723 245.594 220.231C228.336 210.072 210.114 205.043 190.174 204.938C174.991 204.856 172.926 205.307 160.183 211.501C145.738 218.521 133.874 221.309 129.878 218.622C127.959 217.334 127.89 215.473 129.536 209.362C132.194 199.483 128.632 192.965 120.574 192.965C115.325 192.965 108.281 199.93 105.477 207.895C104.283 211.288 100.632 212.281 100.632 209.214C100.632 208.197 98.6015 206.438 96.1187 205.307C89.9687 202.502 84.3576 207.475 84.3576 215.725C84.3576 220.783 83.5077 221.926 78.4806 223.626C72.063 225.794 50 245.897 50 249.576C50 250.832 52.4249 254.804 55.3905 258.403C61.1409 265.383 64.913 266.624 85.5927 268.34C96.3195 269.23 97.144 269.661 105.936 278.962C110.976 284.295 115.099 290.263 115.099 292.225C115.099 296.043 106.612 304.167 100.641 306.063C96.1748 307.482 95.8873 310.488 100.18 310.877C106.393 311.441 110.039 310.529 120.185 305.879C139.048 297.234 150.284 293.655 158.641 293.631C175.082 293.586 185.544 302.209 179.51 310.83C177.899 313.132 176.581 315.605 176.581 316.327C176.581 318.796 190.911 317.149 191.439 314.621C191.783 312.983 195.537 311.972 202.801 311.557C213.461 310.949 229.262 305.546 231.641 301.693C233.168 299.221 251.927 299.103 253.44 301.555C254.061 302.558 253.091 303.837 251.287 304.4C242.07 307.276 239.945 311.123 247.025 312.124C256.127 313.408 264.952 309.1 268.842 301.47C270.851 297.529 273.303 294.304 274.292 294.304C276.91 294.304 283.255 283.206 283.263 278.611C283.268 275.772 284.925 274.132 289.225 272.712C297.073 270.12 310.228 256.212 327.286 232.468C350.39 200.309 364.377 190.667 388.151 190.51C398.185 190.443 403.889 191.404 410.071 194.203C420.529 198.935 431.26 210.545 434.112 215.629C435.49 218.49 448.726 242.857 449.768 242.857C451.849 242.857 439.349 214.963 435.49 207.366C432.156 200.799 419.791 191.413 410.737 187.529C401.469 183.553 382.713 181.778 372.498 183.912ZM205.965 296.288C210.689 297.6 214.555 299.206 214.555 299.858C214.555 301.483 194.269 309.689 192.273 308.455C191.39 307.91 191.047 300.649 191.047 297.605C191.047 293.193 191.689 292.257 194.211 292.987C195.953 293.49 201.242 294.976 205.965 296.288Z" stroke="currentColor" />
</svg>
