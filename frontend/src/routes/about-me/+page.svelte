<script lang="ts">
    import { Badge, Timeline, TimelineItem } from "flowbite-svelte";
    import profilePhoto from "$lib/assets/profile-photo.jpg";
    import { profile, summary, skillGroups, certifications, jobs, promotedThroughText, personalProjects } from "./content";
</script>

<div class="mx-auto max-w-5xl">
    <section
        class="mb-10 flex flex-col items-center gap-6 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:flex-row sm:text-left dark:border-gray-700 dark:bg-gray-800"
    >
        <img
            src={profilePhoto}
            alt={profile.name}
            class="ring-primary-100 dark:ring-primary-900 h-32 w-32 shrink-0 rounded-full object-cover ring-4 sm:h-40 sm:w-40"
        />
        <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
            <p class="text-primary-600 dark:text-primary-500 mt-1 text-lg font-medium">
                <span>{profile.title}</span> <span class="text-gray-400 dark:text-gray-500">|</span>
                <span>{profile.tagline}</span>
            </p>
        </div>
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
                {#each certifications as cert (cert.id)}
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
                        <p class="text-xs text-gray-500 dark:text-gray-400">ID: <span>{cert.id}</span></p>
                    </li>
                {/each}
            </ul>
        </div>

        <div class="md:col-span-2">
            <h2 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Experience</h2>
            <Timeline>
                {#each jobs as job, i (job.company)}
                    <TimelineItem date={job.duration} isLast={i === jobs.length - 1}>
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
                                &middot; <span>{job.roles[0].duration}</span> &middot; <span>{job.roleLocation}</span>
                            </span>
                        </p>
                        {#if job.roles.length > 1}
                            <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">{promotedThroughText(job)}</p>
                        {/if}
                        <ul class="list-inside list-disc space-y-1 text-gray-600 dark:text-gray-400">
                            {#each job.highlights as highlight (highlight)}
                                <li>{highlight}</li>
                            {/each}
                        </ul>
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
