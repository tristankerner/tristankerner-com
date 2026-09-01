<script lang="ts">
    import { Button } from "flowbite-svelte";
    import { DownloadOutline } from "flowbite-svelte-icons";
    import type { ResumeContent } from "../content";

    let { content }: { content: ResumeContent } = $props();

    type Status = "idle" | "building" | "error";
    let status = $state<Status>("idle");
    // Mirrors the loading-spinner pattern elsewhere on the page: a live region
    // that only ever carries a status update, never layout.
    let announcement = $state("");

    async function download() {
        status = "building";
        announcement = "Building…";
        try {
            // Kept out of the initial /about-me chunk - the whole ZIP/OOXML
            // generator only ever runs after a click.
            const { buildResumeDocx, resumeFileName } = await import("./resume-docx");
            const blob = buildResumeDocx(content);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = resumeFileName(content);
            anchor.click();
            // Revoke on the next task: revoking synchronously can cancel the
            // download in some browsers before it has read the blob.
            setTimeout(() => URL.revokeObjectURL(url), 0);
            status = "idle";
            announcement = "Downloaded.";
        } catch {
            status = "error";
            announcement = "Couldn't build the file — try again";
        }
    }
</script>

<div class="sm:ml-auto">
    <Button
        color="primary"
        onclick={download}
        loading={status === "building"}
        aria-busy={status === "building"}
    >
        <DownloadOutline size="sm" class="me-2" aria-hidden="true" />
        Download résumé (.docx)
    </Button>
    <div class="sr-only" role="status" aria-live="polite">{announcement}</div>
</div>
