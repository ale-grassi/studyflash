import { z } from "zod";

export const MessageDirection = z.enum(["inbound", "outbound"]);
export type MessageDirection = z.infer<typeof MessageDirection>;

export const MessageSchema = z.object({
    id: z.string(),
    ticketId: z.string(),
    direction: MessageDirection,
    body: z.string(), // plain text
    htmlBody: z.string().optional(), // rich HTML
    translatedBody: z.string().optional(), // AI-translated to English
    from: z.string(),
    to: z.string().optional(),
    outlookMessageId: z.string().optional(),
    timestamp: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

export const SendReplySchema = z.object({
    body: z.string().min(1),
    replySource: z.enum(["draft", "agent"]).optional(),
});
export type SendReply = z.infer<typeof SendReplySchema>;
