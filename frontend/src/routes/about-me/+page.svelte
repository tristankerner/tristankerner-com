<script lang="ts">
    import { onMount } from "svelte";
    import { Accordion, AccordionItem, Badge, Spinner, Timeline, TimelineItem } from "flowbite-svelte";
    import profilePhoto from "$lib/assets/profile-photo.jpg";
    import { defaultContent, jobDurationText, roleDurationText, promotedThroughText, viaEmployerText } from "./content";
    import { fetchResume, readCache } from "./remote";
    import DownloadResumeButton from "./docx/DownloadResumeButton.svelte";

    // Starts as the copy compiled into the build - which is exactly what the
    // prerendered HTML already contains, so the page is complete before any
    // script runs and stays complete for a visitor without JavaScript. The live
    // content from the resume microservice replaces it once it arrives.
    let content = $state(defaultContent);
    let loading = $state(false);

    // Read through `content` so a swap re-renders every section at once. The
    // markup below is unchanged by all of this: it still reads plain names.
    const profile = $derived(content.profile);
    const summary = $derived(content.summary);
    const skillGroups = $derived(content.skillGroups);
    const certifications = $derived(content.certifications);
    const jobs = $derived(content.jobs);
    const personalProjects = $derived(content.personalProjects);

    onMount(async () => {
        // A cache hit costs no request and no spinner: the swap is synchronous,
        // so there is nothing to indicate the progress of.
        const cached = readCache();
        if (cached) {
            content = cached;
            return;
        }

        loading = true;
        try {
            const fetched = await fetchResume();
            // null means the feed was unreachable or unreadable; `content` then
            // keeps the built-in copy the visitor is already looking at.
            if (fetched) content = fetched;
        } finally {
            loading = false;
        }
    });
</script>

<div class="mx-auto max-w-5xl">
    <section
        class="relative mb-10 flex flex-col items-center gap-6 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:flex-row sm:text-left dark:border-gray-700 dark:bg-gray-800"
    >
        {#if loading}
            <!-- Positioned out of flow so appearing and disappearing never moves
                 anything: the page is already showing a complete resume, and this
                 only says a newer one is being fetched. -->
            <div class="absolute top-3 right-3" role="status">
                <Spinner size="4" aria-hidden="true" />
                <span class="sr-only">Loading the latest resume content</span>
            </div>
        {/if}
        <img
            src={profilePhoto}
            alt={profile.name}
            class="ring-primary-100 dark:ring-primary-900 h-32 w-32 shrink-0 rounded-full object-cover ring-4 sm:h-40 sm:w-40"
        />
        <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
            <p class="text-primary-600 dark:text-primary-500 mt-1 text-lg font-medium">
                <span>{profile.title}</span> <span class="text-gray-400 dark:text-gray-500" aria-hidden="true">|</span>
                <span>{profile.tagline}</span>
            </p>
        </div>
        <DownloadResumeButton {content} />
    </section>

    <div class="grid gap-10 md:grid-cols-3">
        <div class="md:col-span-1">
            <h2 class="mb-3 text-xl font-bold text-gray-900 dark:text-white">Summary</h2>
            <p class="mb-8 text-gray-600 dark:text-gray-400">{summary}</p>

            <h2 class="mb-3 text-xl font-bold text-gray-900 dark:text-white">Technical Skills</h2>
            <div class="mb-8 space-y-4">
                {#each skillGroups as group (group.name)}
                    <div>
                        <h3 class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                            {group.name}
                        </h3>
                        <div class="flex flex-wrap gap-2">
                            {#each group.skills as skill (skill.name)}
                                <Badge color="primary" rounded href={skill.url} target="_blank">{skill.name}</Badge>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>

            <h2 class="mb-3 text-xl font-bold text-gray-900 dark:text-white">Certifications</h2>
            <ul class="space-y-2">
                <!-- keyed on name, not id: not every issuer numbers its credentials, and
                     two id-less entries would collide on an undefined key. -->
                {#each certifications as cert (cert.name)}
                    <li>
                        <p class="font-medium text-gray-700 dark:text-gray-300">
                            {#if cert.url}
                                <a
                                    href={cert.url}
                                    target="_blank"
                                    class="text-primary-600 dark:text-primary-500 hover:underline"
                                >
                                    {cert.name}
                                </a>
                            {:else}
                                {cert.name}
                            {/if}
                        </p>
                        {#if cert.id}
                            <p class="text-xs text-gray-500 dark:text-gray-400">ID: <span>{cert.id}</span></p>
                        {/if}
                    </li>
                {/each}
            </ul>
        </div>

        <div class="md:col-span-2">
            <h2 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Experience</h2>
            <Timeline>
                {#each jobs as job, i (job.company)}
                    <!-- title is typed as required by flowbite-svelte but only rendered when
                         truthy; we build our own <h3> below instead, so pass "" to satisfy the type. -->
                    <TimelineItem title="" date={jobDurationText(job)} isLast={i === jobs.length - 1}>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                            {#if job.companyUrl}
                                <a href={job.companyUrl} target="_blank" class="hover:underline">{job.company}</a>
                            {:else}
                                {job.company}
                            {/if}
                        </h3>
                        <p class="mb-2 text-sm text-gray-500 italic dark:text-gray-400">
                            <span>{job.companyLocation}</span> &middot; <span>{job.description}</span>
                        </p>
                        <p class="mb-1 font-semibold text-gray-700 dark:text-gray-300">
                            <span>{job.roles[0].title}</span>
                            <span class="font-normal text-gray-500 dark:text-gray-400">
                                &middot; <span>{roleDurationText(job.roles[0])}</span> &middot; <span>{job.roleLocation}</span>
                            </span>
                        </p>
                        {#if job.roles.length > 1 || job.viaEmployer}
                            <div class="mb-3 text-sm text-gray-500 dark:text-gray-400">
                                {#if job.roles.length > 1}
                                    <p>{promotedThroughText(job)}</p>
                                {/if}
                                {#if job.viaEmployer}
                                    <p>{viaEmployerText(job)}</p>
                                {/if}
                            </div>
                        {/if}
                        <Accordion flush multiple class="contents">
                            <!-- A native ::marker can't share its line with a highlight's accordion
                                 trigger (an atomic box either fits next to it or drops to the next
                                 line entirely), so bullets are drawn manually as flex siblings instead. -->
                            <ul class="space-y-1 text-gray-600 dark:text-gray-400">
                                {#each job.highlights as highlight (highlight.summary)}
                                    <li class="flex items-start gap-2">
                                        <span class="mt-2 size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"
                                        ></span>
                                        <div class="min-w-0 flex-1">
                                            {#if highlight.specifics.length > 0}
                                                <AccordionItem
                                                    headingTag="div"
                                                    class="contents"
                                                    classes={{
                                                        button:
                                                            'border-b-0 p-0 text-left font-normal text-gray-600 dark:text-gray-400',
                                                        content: 'border-b-0 p-0 pt-1.5',
                                                    }}
                                                >
                                                    {#snippet header()}
                                                        <span>{highlight.summary}</span>
                                                    {/snippet}
                                                    <ul class="ml-5 list-outside list-[circle] space-y-1 text-sm text-gray-500 dark:text-gray-500">
                                                        {#each highlight.specifics as specific (specific)}
                                                            <li>{specific}</li>
                                                        {/each}
                                                    </ul>
                                                </AccordionItem>
                                            {:else}
                                                {highlight.summary}
                                            {/if}
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        </Accordion>
                    </TimelineItem>
                {/each}
            </Timeline>
        </div>
    </div>

    <section class="mt-12 border-t border-gray-200 pt-8 dark:border-gray-700">
        <h2 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Personal Projects</h2>
        <ul class="space-y-4">
            {#each personalProjects as project, i (project.name ?? i)}
                <li>
                    {#if project.name}
                        <p class="font-semibold text-gray-700 dark:text-gray-300">
                            {#if project.link}
                                <a
                                    href={project.link}
                                    target="_blank"
                                    class="text-primary-600 dark:text-primary-500 hover:underline"
                                >
                                    {project.name}
                                </a>
                            {:else}
                                {project.name}
                            {/if}
                        </p>
                    {/if}
                    <p class="text-gray-600 dark:text-gray-400">{project.description}</p>
                </li>
            {/each}
        </ul>
    </section>
</div>
