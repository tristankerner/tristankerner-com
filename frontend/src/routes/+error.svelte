<script lang="ts">
    import { page } from "$app/state";
</script>

<div class="mx-auto flex max-w-xl flex-col items-center py-24 text-center">
    <p class="text-primary-600 dark:text-primary-500 text-sm font-semibold">{page.status}</p>
    <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {page.status === 404 ? "Page not found" : "Something went wrong"}
    </h1>
    <p class="mt-4 text-gray-600 dark:text-gray-400">
        {page.status === 404
            ? "The page you're looking for doesn't exist or may have moved."
            : (page.error?.message ?? "An unexpected error occurred.")}
    </p>
    <a
        href="/"
        class="bg-primary-600 hover:bg-primary-700 mt-8 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
    >
        Back to home
    </a>
</div>
