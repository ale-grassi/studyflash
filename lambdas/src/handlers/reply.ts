import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getTicket, appendMessage, updateTicket } from "../lib/dynamodb.js";
import { sendReply } from "../lib/graph.js";
import { translateToLanguage } from "../lib/bedrock.js";
import { SendReplySchema } from "@studyflash/shared";
import { v4 as uuid } from "uuid";

function json(statusCode: number, body: unknown) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    try {
        const ticketId = event.pathParameters?.id;
        if (!ticketId) return json(400, { error: "Missing ticket ID" });

        const body = JSON.parse(event.body ?? "{}");
        const { body: replyBody, replySource } = SendReplySchema.parse(body);

        const ticket = await getTicket(ticketId);
        if (!ticket) return json(404, { error: "Ticket not found" });

        // Translate the reply to the user's language if needed
        let outboundText = replyBody;
        if (ticket.language && ticket.language !== "en") {
            try {
                outboundText = await translateToLanguage(replyBody, ticket.language);
                console.log(`Translated reply for ticket ${ticketId}: en → ${ticket.language}`);
            } catch (translateErr) {
                console.error(`Translation failed, sending original text:`, translateErr);
                outboundText = replyBody; // fallback to original
            }
        }

        // Send via Graph API if we have an Outlook message ID
        let outlookMessageId: string | undefined;
        if (ticket.outlookMessageId) {
            outlookMessageId = await sendReply(ticket.outlookMessageId, outboundText);
        }

        // Store outbound message in DynamoDB (original agent text for reference)
        const message = {
            id: uuid(),
            ticketId,
            direction: "outbound" as const,
            body: outboundText, // translated text that was sent
            translatedBody: ticket.language !== "en" ? replyBody : undefined, // original English for agent reference
            from: "support@studyflash.ai",
            to: ticket.fromEmail,
            outlookMessageId,
            timestamp: new Date().toISOString(),
        };
        await appendMessage(message);

        // Update ticket status to waiting (for customer response)
        await updateTicket(ticketId, {
            status: "waiting",
            lastReplySource: replySource ?? "agent",
            lastReplyAt: new Date().toISOString(),
        });

        return json(200, { message, ticket: await getTicket(ticketId) });
    } catch (err) {
        console.error("Reply handler error:", err);
        return json(500, { error: "Internal server error" });
    }
};
