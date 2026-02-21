import type { SQSHandler } from "aws-lambda";
import { updateTicket, getMessages, updateMessage } from "../lib/dynamodb.js";
import { classifyAndDraft, updateSummary } from "../lib/bedrock.js";

/**
 * SQS-triggered Lambda that processes tickets through the AI pipeline.
 *
 * Two modes:
 * - "new" (default): Full classification + draft for new tickets
 * - "update": Re-generate summary + translate latest message for follow-ups
 */
export const handler: SQSHandler = async (event) => {
    for (const record of event.Records) {
        const { ticketId, subject, body, from, mode, messageId, language } =
            JSON.parse(record.body);

        try {
            if (mode === "update") {
                // ── Follow-up message: update summary + translate ──
                console.log(`Updating summary for ticket ${ticketId}`);

                const messages = await getMessages(ticketId);
                const ticketLang = language || "en";

                const result = await updateSummary(messages, subject, ticketLang);

                await updateTicket(ticketId, {
                    summary: result.summary,
                    translatedBody: result.translatedBody,
                });

                // Write per-message translation
                if (messageId && result.translatedBody && ticketLang !== "en") {
                    await updateMessage(ticketId, messageId, {
                        translatedBody: result.translatedBody,
                    });
                }

                console.log(`Updated summary for ticket ${ticketId}`);
            } else {
                // ── New ticket: full classification ──────────────
                console.log(`Processing ticket ${ticketId}: "${subject}"`);

                const result = await classifyAndDraft(subject, body, from);

                console.log(
                    `Classified ticket ${ticketId}: category=${result.category}, priority=${result.priority}, lang=${result.language}, assignee=${result.suggestedAssignee}`
                );

                // Update ticket with AI results
                await updateTicket(ticketId, {
                    category: result.category,
                    priority: result.priority,
                    language: result.language,
                    summary: result.summary,
                    translatedSubject: result.translatedSubject,
                    translatedBody: result.translatedBody,
                    assigneeId: result.suggestedAssignee,
                    aiDraftReply: result.draftReply,
                    tags: result.shouldAutoClose
                        ? ["ai_processed", "auto_closed"]
                        : ["ai_processed", "ai_draft"],
                    status: result.shouldAutoClose ? "closed" : "open",
                });

                // Write per-message translation on the initial message
                if (messageId && result.translatedBody && result.language !== "en") {
                    await updateMessage(ticketId, messageId, {
                        translatedBody: result.translatedBody,
                    });
                }

                console.log(
                    `Updated ticket ${ticketId}${result.shouldAutoClose ? " (auto-closed)" : ""}`
                );
            }
        } catch (err) {
            console.error(`Failed to process ticket ${ticketId}:`, err);
            throw err; // Let SQS retry (up to maxReceiveCount, then DLQ)
        }
    }
};
