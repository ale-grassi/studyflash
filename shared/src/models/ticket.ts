import { z } from "zod";

// ── Status ──────────────────────────────────────────────────
export const TicketStatus = z.enum([
    "open",
    "in_progress",
    "waiting",
    "resolved",
    "closed",
]);
export type TicketStatus = z.infer<typeof TicketStatus>;

// ── Priority ────────────────────────────────────────────────
export const TicketPriority = z.enum(["critical", "high", "medium", "low"]);
export type TicketPriority = z.infer<typeof TicketPriority>;

// ── Category (derived from real ticket tags) ────────────────
export const TicketCategory = z.enum([
    "subscription_cancellation",
    "refund_request",
    "billing_invoice",
    "flashcard_issues",
    "quiz_issues",
    "content_upload",
    "language_issues",
    "technical_errors",
    "account_issues",
    "podcast_issues",
    "summary_issues",
    "mock_exam_issues",
    "mindmap_issues",
    "general_how_to",
    "data_loss",
    "misunderstanding",
    "garbage",
]);
export type TicketCategory = z.infer<typeof TicketCategory>;

// ── Workflow tags ───────────────────────────────────────────
export const TicketTag = z.enum([
    "ai_draft",
    "auto_closed",
    "ai_processed",
    "needs_review",
]);
export type TicketTag = z.infer<typeof TicketTag>;

// ── Source ───────────────────────────────────────────────────
export const TicketSource = z.enum(["web", "mobile", "email"]);
export type TicketSource = z.infer<typeof TicketSource>;

export const ReplySource = z.enum(["draft", "agent"]);
export type ReplySource = z.infer<typeof ReplySource>;

// ── Ticket ──────────────────────────────────────────────────
export const TicketSchema = z.object({
    id: z.string(),
    subject: z.string(),
    from: z.string(),
    fromEmail: z.string().email(),
    status: TicketStatus,
    priority: TicketPriority,
    category: TicketCategory,
    tags: z.array(TicketTag).default([]),
    language: z.string(), // ISO 639-1 code: "de", "fr", "it", "nl", "en"
    summary: z.string().optional(), // AI-generated summary
    translatedSubject: z.string().optional(), // AI-translated subject to English
    translatedBody: z.string().optional(), // AI-translated to English
    assigneeId: z.string().optional(),
    aiDraftReply: z.string().optional(),
    lastReplySource: ReplySource.optional(),
    lastReplyAt: z.string().datetime().optional(),
    conversationId: z.string().optional(), // Outlook thread correlation
    outlookMessageId: z.string().optional(),
    source: TicketSource,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Ticket = z.infer<typeof TicketSchema>;

// ── API helpers ─────────────────────────────────────────────
export const UpdateTicketSchema = z.object({
    status: TicketStatus.optional(),
    priority: TicketPriority.optional(),
    assigneeId: z.string().nullable().optional(),
    tags: z.array(TicketTag).optional(),
});
export type UpdateTicket = z.infer<typeof UpdateTicketSchema>;

export const TicketFilterSchema = z.object({
    status: TicketStatus.optional(),
    priority: TicketPriority.optional(),
    category: TicketCategory.optional(),
    assigneeId: z.string().optional(),
    search: z.string().optional(),
});
export type TicketFilter = z.infer<typeof TicketFilterSchema>;
