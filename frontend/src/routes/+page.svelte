<script lang="ts">
    import { page } from "$app/state";
    import { getTickets, getTeamMembers } from "$lib/api";
    import {
        formatDate,
        PRIORITY_COLORS,
        STATUS_COLORS,
        CATEGORY_LABELS,
        LANGUAGE_FLAGS,
        cn,
    } from "$lib/utils";
    import {
        Search,
        Filter,
        ArrowUpDown,
        Circle,
        Smartphone,
        Mail,
        Globe,
        Bot,
        X,
    } from "lucide-svelte";
    import type { Ticket, TicketStatus, TicketPriority } from "$lib/mock/data";

    let tickets = $state<Ticket[]>([]);
    let loading = $state(true);
    let searchQuery = $state("");
    let statusFilter = $state<string>("");
    let priorityFilter = $state<string>("");

    const teamMembers = getTeamMembers();

    async function loadTickets() {
        loading = true;
        const params = page.url.searchParams;
        const filters: Record<string, string> = {};
        if (params.get("status")) filters.status = params.get("status")!;
        if (params.get("assigneeId"))
            filters.assigneeId = params.get("assigneeId")!;
        tickets = await getTickets(filters);
        loading = false;
    }

    $effect(() => {
        // Re-run when URL changes
        void page.url.search;
        loadTickets();
    });

    let filteredTickets = $derived.by(() => {
        let result = tickets;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (t) =>
                    t.subject.toLowerCase().includes(q) ||
                    t.translatedSubject?.toLowerCase().includes(q) ||
                    t.from.toLowerCase().includes(q) ||
                    t.summary?.toLowerCase().includes(q),
            );
        }
        if (statusFilter)
            result = result.filter((t) => t.status === statusFilter);
        if (priorityFilter)
            result = result.filter((t) => t.priority === priorityFilter);
        return result;
    });

    const sourceIcon: Record<string, any> = {
        mobile: Smartphone,
        email: Mail,
        web: Globe,
    };

    const statusCounts = $derived.by(() => {
        const counts: Record<string, number> = {};
        for (const t of tickets) counts[t.status] = (counts[t.status] || 0) + 1;
        return counts;
    });

    const hasActiveFilters = $derived(
        !!searchQuery || !!statusFilter || !!priorityFilter,
    );

    function clearFilters() {
        searchQuery = "";
        statusFilter = "";
        priorityFilter = "";
    }
</script>

<svelte:head>
    <title>Tickets — Studyflash Support</title>
</svelte:head>

<div class="p-6 max-w-[1400px] mx-auto">
    <!-- Header -->
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-foreground">Support Tickets</h1>
        <p class="text-sm text-muted-foreground mt-1">
            {tickets.length} tickets • {statusCounts["open"] ?? 0} open
        </p>
    </div>

    <!-- Status pills -->
    <div class="flex gap-2 mb-4 flex-wrap">
        {#each [["", "All"], ["open", "Open"], ["in_progress", "In Progress"], ["waiting", "Waiting"], ["resolved", "Resolved"], ["closed", "Closed"]] as [value, label]}
            <button
                onclick={() =>
                    (statusFilter = statusFilter === value ? "" : value)}
                class={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150",
                    statusFilter === value
                        ? value
                            ? STATUS_COLORS[value]
                            : "bg-foreground/10 text-foreground border-foreground/20"
                        : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground",
                )}
            >
                {label}
                {#if value && statusCounts[value]}
                    <span class="ml-1 opacity-70">{statusCounts[value]}</span>
                {/if}
            </button>
        {/each}
    </div>

    <!-- Search + filters bar -->
    <div class="flex gap-3 mb-4">
        <div class="relative flex-1">
            <Search
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            />
            <input
                type="text"
                placeholder="Search tickets by subject, sender, or summary..."
                bind:value={searchQuery}
                class="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
            />
        </div>
        <select
            bind:value={priorityFilter}
            class="px-3 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer min-w-[130px]"
        >
            <option value="">All Priorities</option>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
        </select>
        {#if hasActiveFilters}
            <button
                onclick={clearFilters}
                class="px-3 py-2.5 bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
                <X class="w-3.5 h-3.5" />
                Clear
            </button>
        {/if}
    </div>

    <!-- Ticket list -->
    {#if loading}
        <div class="flex items-center justify-center h-64">
            <div class="flex items-center gap-3 text-muted-foreground">
                <div
                    class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
                ></div>
                Loading tickets...
            </div>
        </div>
    {:else if filteredTickets.length === 0}
        <div
            class="flex flex-col items-center justify-center h-64 text-muted-foreground"
        >
            <Search class="w-10 h-10 mb-3 opacity-40" />
            <p>No tickets found</p>
            {#if hasActiveFilters}
                <button
                    onclick={clearFilters}
                    class="text-primary text-sm mt-2 hover:underline"
                >
                    Clear filters
                </button>
            {/if}
        </div>
    {:else}
        <div class="space-y-1.5">
            {#each filteredTickets as ticket (ticket.id)}
                <a
                    href="/tickets/{ticket.id}"
                    class="group flex items-center gap-4 px-4 py-3.5 bg-card hover:bg-card/80 rounded-xl border border-border/50 hover:border-border transition-all duration-150 cursor-pointer"
                >
                    <!-- Priority dot -->
                    <div class="shrink-0">
                        <Circle
                            class={cn(
                                "w-2.5 h-2.5 fill-current",
                                ticket.priority === "critical" &&
                                    "text-red-500",
                                ticket.priority === "high" && "text-orange-500",
                                ticket.priority === "medium" &&
                                    "text-yellow-500",
                                ticket.priority === "low" && "text-green-500",
                            )}
                        />
                    </div>

                    <!-- Source icon -->
                    <div class="shrink-0 text-muted-foreground/50">
                        {#if sourceIcon[ticket.source]}
                            {@const Icon = sourceIcon[ticket.source]}
                            <Icon class="w-4 h-4" />
                        {/if}
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span
                                class="text-sm font-medium text-foreground truncate"
                            >
                                {ticket.language !== "en" &&
                                ticket.translatedSubject
                                    ? ticket.translatedSubject
                                    : ticket.subject || "(No subject)"}
                            </span>
                            {#if ticket.language && LANGUAGE_FLAGS[ticket.language]}
                                <span class="text-xs shrink-0"
                                    >{LANGUAGE_FLAGS[ticket.language]}</span
                                >
                            {/if}
                            {#if ticket.tags.includes("ai_draft")}
                                <span
                                    class="shrink-0"
                                    title="AI draft available"
                                >
                                    <Bot class="w-3.5 h-3.5 text-primary/60" />
                                </span>
                            {/if}
                        </div>
                        <div
                            class="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                            <span class="truncate">{ticket.from}</span>
                            <span>·</span>
                            <span class="shrink-0"
                                >{formatDate(ticket.createdAt)}</span
                            >
                            {#if ticket.summary}
                                <span>·</span>
                                <span class="truncate opacity-70"
                                    >{ticket.summary}</span
                                >
                            {/if}
                        </div>
                    </div>

                    <!-- Category badge -->
                    <span
                        class="shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-md bg-secondary text-muted-foreground border border-border"
                    >
                        {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                    </span>

                    {#if ticket.lastReplySource}
                        <span
                            class={cn(
                                "shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-md border",
                                ticket.lastReplySource === "draft"
                                    ? "bg-primary/15 text-primary border-primary/30"
                                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                            )}
                            title={ticket.lastReplyAt
                                ? `Last reply: ${formatDate(ticket.lastReplyAt)}`
                                : "Ticket has been replied"}
                        >
                            {ticket.lastReplySource === "draft"
                                ? "Replied: Draft"
                                : "Replied: Agent"}
                        </span>
                    {/if}

                    <!-- Status badge -->
                    <span
                        class={cn(
                            "shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-md border",
                            STATUS_COLORS[ticket.status],
                        )}
                    >
                        {ticket.status.replace("_", " ")}
                    </span>

                    <!-- Assignee -->
                    <div
                        class="shrink-0 w-7 h-7"
                        title={ticket.assigneeId
                            ? teamMembers.find(
                                  (m) => m.id === ticket.assigneeId,
                              )?.name
                            : "Unassigned"}
                    >
                        {#if ticket.assigneeId}
                            <div
                                class="w-7 h-7 rounded-full bg-gradient-to-br from-primary/60 to-purple-400/60 flex items-center justify-center text-[10px] font-semibold text-white"
                            >
                                {teamMembers.find(
                                    (m) => m.id === ticket.assigneeId,
                                )?.name[0] ?? "?"}
                            </div>
                        {:else}
                            <div
                                class="w-7 h-7 rounded-full bg-muted/50 border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground"
                            >
                                ?
                            </div>
                        {/if}
                    </div>

                    <!-- Time -->
                    <span
                        class="shrink-0 text-xs text-muted-foreground w-14 text-right"
                    >
                        {formatDate(ticket.updatedAt)}
                    </span>
                </a>
            {/each}
        </div>
    {/if}
</div>
