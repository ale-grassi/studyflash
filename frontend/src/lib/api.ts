import { mockTickets, mockMessages, mockEnrichment, TEAM_MEMBERS } from "$lib/mock/data";
import type { Ticket, Message, EnrichmentData, TeamMember } from "$lib/mock/data";

const USE_MOCK = false; // Toggle for real API vs mock data
const API_BASE = import.meta.env.VITE_API_URL ?? "https://44nobn6zj7.execute-api.us-east-1.amazonaws.com";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

// ── Tickets ──

export async function getTickets(filters?: {
    status?: string;
    assigneeId?: string;
    search?: string;
}): Promise<Ticket[]> {
    if (USE_MOCK) {
        let tickets = [...mockTickets];
        if (filters?.status) tickets = tickets.filter((t) => t.status === filters.status);
        if (filters?.assigneeId) tickets = tickets.filter((t) => t.assigneeId === filters.assigneeId);
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            tickets = tickets.filter(
                (t) =>
                    t.subject.toLowerCase().includes(q) ||
                    t.from.toLowerCase().includes(q) ||
                    t.summary?.toLowerCase().includes(q)
            );
        }
        return tickets;
    }
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.assigneeId) params.set("assigneeId", filters.assigneeId);
    if (filters?.search) params.set("search", filters.search);
    const { tickets } = await apiFetch<{ tickets: Ticket[] }>(`/tickets?${params}`);
    return tickets;
}

export async function getTicket(id: string): Promise<{ ticket: Ticket; messages: Message[] }> {
    if (USE_MOCK) {
        const ticket = mockTickets.find((t) => t.id === id);
        if (!ticket) throw new Error("Ticket not found");
        const messages = mockMessages[id] ?? [];
        return { ticket, messages };
    }
    return apiFetch(`/tickets/${id}`);
}

export async function updateTicket(
    id: string,
    updates: Partial<Pick<Ticket, "status" | "priority" | "assigneeId">>
): Promise<Ticket> {
    if (USE_MOCK) {
        const ticket = mockTickets.find((t) => t.id === id);
        if (!ticket) throw new Error("Ticket not found");
        Object.assign(ticket, updates, { updatedAt: new Date().toISOString() });
        return ticket;
    }
    const { ticket } = await apiFetch<{ ticket: Ticket }>(`/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
    return ticket;
}

// ── Reply ──

export async function sendReply(
    ticketId: string,
    body: string,
    replySource: "draft" | "agent" = "agent"
): Promise<Message> {
    if (USE_MOCK) {
        const msg: Message = {
            id: `m-${Date.now()}`,
            ticketId,
            direction: "outbound",
            body,
            from: "You",
            timestamp: new Date().toISOString(),
        };
        if (!mockMessages[ticketId]) mockMessages[ticketId] = [];
        mockMessages[ticketId].push(msg);
        // Update ticket status
        const ticket = mockTickets.find((t) => t.id === ticketId);
        if (ticket) {
            ticket.status = "waiting";
            ticket.lastReplySource = replySource;
            ticket.lastReplyAt = new Date().toISOString();
        }
        return msg;
    }
    const { message } = await apiFetch<{ message: Message }>(`/tickets/${ticketId}/reply`, {
        method: "POST",
        body: JSON.stringify({ body, replySource }),
    });
    return message;
}

export async function generateDraft(ticketId: string): Promise<{ draftReply: string; ticket?: Ticket }> {
    if (USE_MOCK) {
        const ticket = mockTickets.find((t) => t.id === ticketId);
        if (!ticket) throw new Error("Ticket not found");
        const draftReply =
            ticket.aiDraftReply ??
            "Hi,\n\nThanks for your message. We are looking into this and will get back to you shortly.\n\nBest regards,\nStudyflash Support";
        ticket.aiDraftReply = draftReply;
        if (!ticket.tags.includes("ai_draft")) ticket.tags.push("ai_draft");
        return { draftReply, ticket };
    }

    return apiFetch<{ draftReply: string; ticket?: Ticket }>(`/tickets/${ticketId}/draft`, {
        method: "POST",
    });
}

// ── Enrichment ──

export async function getEnrichment(ticketId: string): Promise<EnrichmentData> {
    if (USE_MOCK) {
        return (
            mockEnrichment[ticketId] ?? {
                sentryErrors: [],
                posthogSessions: [],
                userData: undefined,
            }
        );
    }
    return apiFetch(`/tickets/${ticketId}/enrichment`);
}

// ── Team ──

export function getTeamMembers(): TeamMember[] {
    return TEAM_MEMBERS;
}
