<script lang="ts">
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import {
        getTicket,
        getEnrichment,
        updateTicket,
        sendReply,
        generateDraft,
        getTeamMembers,
    } from "$lib/api";
    import {
        formatDate,
        formatDateTime,
        PRIORITY_COLORS,
        STATUS_COLORS,
        CATEGORY_LABELS,
        LANGUAGE_FLAGS,
        cn,
    } from "$lib/utils";
    import {
        ArrowLeft,
        Bot,
        Send,
        Sparkles,
        ExternalLink,
        AlertTriangle,
        User,
        Clock,
        Tag,
        Globe,
        Bug,
        Video,
        CreditCard,
        Smartphone,
        Mail,
        Loader2,
        Languages,
        ChevronDown,
    } from "lucide-svelte";
    import type { Ticket, Message, EnrichmentData } from "$lib/mock/data";

    let ticket = $state<Ticket | null>(null);
    let messages = $state<Message[]>([]);
    let enrichment = $state<EnrichmentData | null>(null);
    let loading = $state(true);
    let replyText = $state("");
    let sending = $state(false);
    let generatingDraft = $state(false);
    let showTranslation = $state(false);
    let expandedTranslations = $state<Set<string>>(new Set());

    const teamMembers = getTeamMembers();
    const ticketId = $derived(page.params.id);

    $effect(() => {
        load(ticketId);
    });

    async function load(id: string) {
        loading = true;
        try {
            const data = await getTicket(id);
            ticket = data.ticket;
            messages = data.messages;
            enrichment = await getEnrichment(id);
        } catch {
            ticket = null;
        }
        loading = false;
    }

    async function handleSendReply() {
        if (!replyText.trim() || !ticket) return;
        sending = true;
        try {
            const isDraftReply =
                !!ticket.aiDraftReply &&
                replyText.trim() === ticket.aiDraftReply.trim();
            const msg = await sendReply(
                ticket.id,
                replyText,
                isDraftReply ? "draft" : "agent"
            );
            messages = [...messages, msg];
            replyText = "";
            if (ticket) {
                ticket.status = "waiting";
                ticket.lastReplySource = isDraftReply ? "draft" : "agent";
                ticket.lastReplyAt = new Date().toISOString();
            }
        } finally {
            sending = false;
        }
    }

    async function handleGenerateDraft() {
        if (!ticket || generatingDraft) return;
        generatingDraft = true;
        try {
            const result = await generateDraft(ticket.id);
            const draft = result.draftReply?.trim() ?? "";
            if (draft) replyText = draft;
            if (result.ticket) ticket = result.ticket as Ticket;
        } finally {
            generatingDraft = false;
        }
    }

    async function handleStatusChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        if (!ticket) return;
        await updateTicket(ticket.id, { status: target.value as any });
        ticket.status = target.value as any;
    }

    async function handlePriorityChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        if (!ticket) return;
        await updateTicket(ticket.id, { priority: target.value as any });
        ticket.priority = target.value as any;
    }

    async function handleAssigneeChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        if (!ticket) return;
        const val = target.value || undefined;
        await updateTicket(ticket.id, { assigneeId: val as any });
        ticket.assigneeId = val;
    }
</script>

<svelte:head>
    <title>{ticket?.subject || "Ticket"} — Studyflash Support</title>
</svelte:head>

{#if loading}
    <div class="flex items-center justify-center h-full">
        <div class="flex items-center gap-3 text-muted-foreground">
            <Loader2 class="w-5 h-5 animate-spin" />
            Loading ticket...
        </div>
    </div>
{:else if !ticket}
    <div
        class="flex flex-col items-center justify-center h-full text-muted-foreground"
    >
        <p>Ticket not found</p>
        <a href="/" class="text-primary text-sm mt-2 hover:underline"
            >Back to tickets</a
        >
    </div>
{:else}
    <div class="flex h-full">
        <!-- Left: Thread -->
        <div class="flex-1 flex flex-col min-w-0 border-r border-border">
            <!-- Header -->
            <div class="shrink-0 px-6 py-4 border-b border-border bg-card/50">
                <div class="flex items-center gap-3 mb-2">
                    <a
                        href="/"
                        class="p-1.5 -ml-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft class="w-4 h-4" />
                    </a>
                    <div class="flex items-center gap-2 min-w-0">
                        {#if ticket.language && LANGUAGE_FLAGS[ticket.language]}
                            <span class="text-sm"
                                >{LANGUAGE_FLAGS[ticket.language]}</span
                            >
                        {/if}
                        <h2
                            class="text-lg font-semibold text-foreground truncate"
                        >
                            {ticket.subject || "(No subject)"}
                        </h2>
                    </div>
                </div>
                <div
                    class="flex items-center gap-3 text-xs text-muted-foreground ml-8"
                >
                    <span class="flex items-center gap-1">
                        {#if ticket.source === "mobile"}
                            <Smartphone class="w-3 h-3" />
                        {:else}
                            <Mail class="w-3 h-3" />
                        {/if}
                        {ticket.from}
                    </span>
                    <span>·</span>
                    <span>{formatDateTime(ticket.createdAt)}</span>
                    {#if ticket.tags.includes("ai_processed")}
                        <span>·</span>
                        <span class="flex items-center gap-1 text-primary/70">
                            <Bot class="w-3 h-3" />
                            AI Processed
                        </span>
                    {/if}
                </div>
            </div>

            <!-- AI Summary bar -->
            {#if ticket.summary}
                <div
                    class="shrink-0 px-6 py-3 bg-primary/5 border-b border-primary/10"
                >
                    <div class="flex items-start gap-2">
                        <Sparkles
                            class="w-4 h-4 text-primary mt-0.5 shrink-0"
                        />
                        <div class="text-sm text-foreground/80">
                            <span
                                class="text-xs font-medium text-primary/70 uppercase tracking-wider"
                                >AI Summary</span
                            >
                            <p class="mt-0.5">{ticket.summary}</p>
                        </div>
                    </div>
                    {#if ticket.translatedBody && ticket.language !== "en"}
                        <button
                            onclick={() => (showTranslation = !showTranslation)}
                            class="flex items-center gap-1 mt-2 ml-6 text-xs text-primary/60 hover:text-primary transition-colors"
                        >
                            <Languages class="w-3 h-3" />
                            {showTranslation ? "Hide" : "Show"} English translation
                            <ChevronDown
                                class={cn(
                                    "w-3 h-3 transition-transform",
                                    showTranslation && "rotate-180",
                                )}
                            />
                        </button>
                        {#if showTranslation}
                            <div
                                class="mt-2 ml-6 p-3 bg-background/50 rounded-lg text-sm text-muted-foreground whitespace-pre-wrap"
                            >
                                {ticket.translatedBody}
                            </div>
                        {/if}
                    {/if}
                </div>
            {/if}

            <!-- Messages thread -->
            <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {#each messages as msg (msg.id)}
                    <div
                        class={cn(
                            "max-w-[85%] rounded-xl px-4 py-3",
                            msg.direction === "inbound"
                                ? "bg-card border border-border mr-auto"
                                : "bg-primary/10 border border-primary/20 ml-auto",
                        )}
                    >
                        <div class="flex items-center gap-2 mb-1.5">
                            <span
                                class={cn(
                                    "text-xs font-medium",
                                    msg.direction === "inbound"
                                        ? "text-foreground"
                                        : "text-primary",
                                )}
                            >
                                {msg.from}
                            </span>
                            <span class="text-[10px] text-muted-foreground">
                                {formatDateTime(msg.timestamp)}
                            </span>
                        </div>
                        {#if msg.htmlBody}
                            <iframe
                                srcdoc={msg.htmlBody}
                                sandbox="allow-same-origin"
                                class="w-full border-0 rounded bg-white min-h-[60px]"
                                title="Email content"
                                onload={(e) => {
                                    const iframe = e.currentTarget;
                                    if (iframe.contentDocument) {
                                        iframe.style.height =
                                            iframe.contentDocument
                                                .documentElement.scrollHeight +
                                            "px";
                                    }
                                }}
                            ></iframe>
                        {:else}
                            <p
                                class="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed"
                            >
                                {msg.body}
                            </p>
                        {/if}
                        {#if msg.translatedBody}
                            <button
                                onclick={() => {
                                    const next = new Set(expandedTranslations);
                                    if (next.has(msg.id)) next.delete(msg.id);
                                    else next.add(msg.id);
                                    expandedTranslations = next;
                                }}
                                class="flex items-center gap-1 mt-2 text-[11px] text-primary/60 hover:text-primary transition-colors"
                            >
                                <Languages class="w-3 h-3" />
                                {expandedTranslations.has(msg.id) ? "Hide" : "Show"}
                                {msg.direction === "inbound" ? "English translation" : "original English"}
                            </button>
                            {#if expandedTranslations.has(msg.id)}
                                <div class="mt-1.5 p-2.5 bg-primary/5 rounded-lg text-xs text-muted-foreground whitespace-pre-wrap">
                                    {msg.translatedBody}
                                </div>
                            {/if}
                        {/if}
                    </div>
                {/each}

                {#if messages.length === 0}
                    <div
                        class="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm"
                    >
                        <Mail class="w-8 h-8 mb-2 opacity-30" />
                        No messages in this thread yet
                    </div>
                {/if}
            </div>

            <!-- Reply composer -->
            <div class="shrink-0 px-6 py-4 border-t border-border bg-card/30">
                <button
                    onclick={handleGenerateDraft}
                    disabled={generatingDraft}
                    class={cn(
                        "flex items-center gap-2 mb-3 px-3 py-2 border rounded-lg text-sm transition-all duration-150 w-full",
                        generatingDraft
                            ? "bg-secondary text-muted-foreground border-border cursor-not-allowed"
                            : "bg-primary/10 hover:bg-primary/15 border-primary/20 text-primary",
                    )}
                >
                    {#if generatingDraft}
                        <Loader2 class="w-4 h-4 animate-spin" />
                        <span class="font-medium">Generating AI Draft...</span>
                    {:else}
                        <Sparkles class="w-4 h-4" />
                        <span class="font-medium">{ticket.aiDraftReply ? "Regenerate AI Draft" : "Generate AI Draft"}</span>
                    {/if}
                </button>
                <div class="flex gap-2">
                    <textarea
                        bind:value={replyText}
                        placeholder="Type your reply..."
                        rows="3"
                        class="flex-1 px-4 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 resize-none transition-all"
                    ></textarea>
                    <button
                        onclick={handleSendReply}
                        disabled={!replyText.trim() || sending}
                        class={cn(
                            "self-end px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2",
                            replyText.trim() && !sending
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "bg-secondary text-muted-foreground cursor-not-allowed",
                        )}
                    >
                        {#if sending}
                            <Loader2 class="w-4 h-4 animate-spin" />
                        {:else}
                            <Send class="w-4 h-4" />
                        {/if}
                        Send
                    </button>
                </div>
            </div>
        </div>

        <!-- Right: Sidebar -->
        <div class="w-80 shrink-0 overflow-y-auto bg-card/30">
            <!-- Ticket controls -->
            <div class="p-5 border-b border-border space-y-4">
                <h3
                    class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                    Ticket Details
                </h3>

                <!-- Status -->
                <div>
                    <label class="text-xs text-muted-foreground mb-1 block"
                        >Status</label
                    >
                    <select
                        value={ticket.status}
                        onchange={handleStatusChange}
                        class={cn(
                            "w-full px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
                            STATUS_COLORS[ticket.status],
                            "bg-transparent",
                        )}
                    >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="waiting">Waiting</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>

                <!-- Priority -->
                <div>
                    <label class="text-xs text-muted-foreground mb-1 block"
                        >Priority</label
                    >
                    <select
                        value={ticket.priority}
                        onchange={handlePriorityChange}
                        class={cn(
                            "w-full px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40",
                            PRIORITY_COLORS[ticket.priority],
                            "bg-transparent",
                        )}
                    >
                        <option value="critical">🔴 Critical</option>
                        <option value="high">🟠 High</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="low">🟢 Low</option>
                    </select>
                </div>

                <!-- Assignee -->
                <div>
                    <label class="text-xs text-muted-foreground mb-1 block"
                        >Assigned to</label
                    >
                    <select
                        value={ticket.assigneeId ?? ""}
                        onchange={handleAssigneeChange}
                        class="w-full px-3 py-2 bg-transparent border border-border rounded-lg text-xs text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                        <option value="">Unassigned</option>
                        {#each teamMembers as member}
                            <option value={member.id}
                                >{member.name} ({member.role})</option
                            >
                        {/each}
                    </select>
                </div>

                <!-- Meta -->
                <div class="space-y-2 pt-2 border-t border-border">
                    <div class="flex items-center justify-between">
                        <span
                            class="text-xs text-muted-foreground flex items-center gap-1.5"
                        >
                            <Tag class="w-3 h-3" /> Category
                        </span>
                        <span class="text-xs text-foreground"
                            >{CATEGORY_LABELS[ticket.category]}</span
                        >
                    </div>
                    <div class="flex items-center justify-between">
                        <span
                            class="text-xs text-muted-foreground flex items-center gap-1.5"
                        >
                            <Globe class="w-3 h-3" /> Language
                        </span>
                        <span class="text-xs text-foreground">
                            {LANGUAGE_FLAGS[ticket.language] ?? ""}
                            {ticket.language?.toUpperCase()}
                        </span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span
                            class="text-xs text-muted-foreground flex items-center gap-1.5"
                        >
                            <Clock class="w-3 h-3" /> Created
                        </span>
                        <span class="text-xs text-foreground"
                            >{formatDateTime(ticket.createdAt)}</span
                        >
                    </div>
                </div>
            </div>

            <!-- Enrichment: User Data -->
            {#if enrichment?.userData}
                <div class="p-5 border-b border-border">
                    <h3
                        class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"
                    >
                        <User class="w-3 h-3" /> User Profile
                    </h3>
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-xs text-muted-foreground"
                                >Plan</span
                            >
                            <span class="text-xs font-medium text-foreground">
                                {enrichment.userData.plan.replace("_", " ")}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-xs text-muted-foreground"
                                >Signed up</span
                            >
                            <span class="text-xs text-foreground">
                                {formatDate(enrichment.userData.signupDate)}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-xs text-muted-foreground"
                                >Last active</span
                            >
                            <span class="text-xs text-foreground">
                                {formatDate(enrichment.userData.lastActive)}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-xs text-muted-foreground"
                                >Past tickets</span
                            >
                            <span class="text-xs text-foreground"
                                >{enrichment.userData.ticketCount}</span
                            >
                        </div>
                        {#if enrichment.userData.country}
                            <div class="flex justify-between">
                                <span class="text-xs text-muted-foreground"
                                    >Country</span
                                >
                                <span class="text-xs text-foreground"
                                    >{enrichment.userData.country}</span
                                >
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- Enrichment: Sentry Errors -->
            {#if enrichment && enrichment.sentryErrors.length > 0}
                <div class="p-5 border-b border-border">
                    <h3
                        class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"
                    >
                        <Bug class="w-3 h-3" /> Sentry Errors
                    </h3>
                    <div class="space-y-2">
                        {#each enrichment.sentryErrors as error}
                            <a
                                href={error.url}
                                target="_blank"
                                rel="noopener"
                                class="block p-2.5 bg-background rounded-lg border border-border hover:border-foreground/20 transition-colors group"
                            >
                                <div class="flex items-start gap-2">
                                    <AlertTriangle
                                        class={cn(
                                            "w-3.5 h-3.5 mt-0.5 shrink-0",
                                            error.level === "error"
                                                ? "text-red-400"
                                                : "text-yellow-400",
                                        )}
                                    />
                                    <div class="min-w-0">
                                        <p
                                            class="text-xs text-foreground font-mono truncate"
                                        >
                                            {error.title}
                                        </p>
                                        <p
                                            class="text-[10px] text-muted-foreground mt-1"
                                        >
                                            {error.count} events · {formatDate(
                                                error.lastSeen,
                                            )}
                                        </p>
                                    </div>
                                    <ExternalLink
                                        class="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0"
                                    />
                                </div>
                            </a>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Enrichment: Posthog Sessions -->
            {#if enrichment && enrichment.posthogSessions.length > 0}
                <div class="p-5">
                    <h3
                        class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5"
                    >
                        <Video class="w-3 h-3" /> Session Recordings
                    </h3>
                    <div class="space-y-2">
                        {#each enrichment.posthogSessions as session}
                            <a
                                href={session.url}
                                target="_blank"
                                rel="noopener"
                                class="flex items-center gap-2.5 p-2.5 bg-background rounded-lg border border-border hover:border-foreground/20 transition-colors group"
                            >
                                <div
                                    class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center"
                                >
                                    <Video class="w-4 h-4 text-purple-400" />
                                </div>
                                <div class="min-w-0">
                                    <p class="text-xs text-foreground">
                                        {Math.floor(
                                            session.duration / 60,
                                        )}:{String(
                                            session.duration % 60,
                                        ).padStart(2, "0")} session
                                    </p>
                                    <p
                                        class="text-[10px] text-muted-foreground"
                                    >
                                        {session.pageCount} pages · {formatDate(
                                            session.timestamp,
                                        )}
                                    </p>
                                </div>
                                <ExternalLink
                                    class="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 ml-auto"
                                />
                            </a>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}
