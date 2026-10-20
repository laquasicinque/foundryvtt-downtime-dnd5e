<script lang="ts">
    import { localize } from "../../foundry/i18n";
    /**
     * A UUID field that accepts drag-and-drop of Foundry documents (from the
     * sidebar or a compendium) and shows what it points at.
     */
    import { dragEventDocument } from "../../foundry/applications";
    import { documentSummary } from "../../foundry/documents";

    type Props = {
        value: string;
        onchange: (uuid: string) => void;
        /** Accepted document types, e.g. ["Item"]. */
        accept: string[];
        placeholder?: string;
    };

    const {
        value,
        onchange,
        accept,
        placeholder = localize("downtime-dnd5e.UuidDrop.Placeholder"),
    }: Props = $props();

    let error = $state<string | null>(null);

    /** Foundry's own name for a document type ("Active Effect"). */
    const documentLabel = (type: string) => localize(`DOCUMENT.${type}`);
    const types = $derived(accept.map(documentLabel).join(" / "));
    let hovering = $state(false);

    let resolved = $state<{ name: string } | null>(null);
    // Loads compendium documents too; a stale lookup never overwrites a newer one.
    $effect(() => {
        const uuid = value;
        if (!uuid) {
            resolved = null;
            return;
        }
        let current = true;
        const resolve = async () => {
            const doc = await documentSummary(uuid);
            if (current) resolved = doc ? { name: doc.name ?? uuid } : null;
        };
        void resolve();
        return () => {
            current = false;
        };
    });

    function ondrop(event: DragEvent) {
        event.preventDefault();
        hovering = false;
        const data = dragEventDocument(event);
        if (!data) {
            error = localize("downtime-dnd5e.UuidDrop.NotADocument");
            return;
        }
        if (!accept.includes(data.type)) {
            error = localize("downtime-dnd5e.UuidDrop.WrongType", {
                expected: types,
                type: documentLabel(data.type),
            });
            return;
        }
        error = null;
        onchange(data.uuid);
    }
</script>

<div
    class="uuid-drop"
    class:hovering
    role="group"
    ondragover={(e) => {
        e.preventDefault();
        hovering = true;
    }}
    ondragleave={() => (hovering = false)}
    {ondrop}
>
    <input
        type="text"
        {value}
        {placeholder}
        oninput={(e) => onchange(e.currentTarget.value.trim())}
    />
    <span class="resolved" class:missing={!!value && !resolved}>
        {#if !value}
            <i class="fas fa-hand-pointer"></i>
            {localize("downtime-dnd5e.UuidDrop.DropA", { types })}
        {:else if resolved}
            <i class="fas fa-link"></i> {resolved.name}
        {:else}
            <i class="fas fa-triangle-exclamation"></i>
            {localize("downtime-dnd5e.UuidDrop.NotFound")}
        {/if}
    </span>
    {#if error}<span class="error">{error}</span>{/if}
</div>

<style>
    .uuid-drop {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        flex: 1 1 12rem;
        border: 1px dashed transparent;
        border-radius: 4px;
    }
    .uuid-drop.hovering {
        border-color: var(--color-level-info, #3a6ea5);
    }
    .resolved {
        font-size: 0.75rem;
        opacity: 0.8;
    }
    .resolved.missing {
        color: var(--color-level-warning, #c80);
    }
    .error {
        font-size: 0.75rem;
        color: var(--color-level-error, #c00);
    }
</style>
