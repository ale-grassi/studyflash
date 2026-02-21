import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getMessages, getTicket, updateTicket } from "../lib/dynamodb.js";
import { generateDraftReply } from "../lib/bedrock.js";

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

        const ticket = await getTicket(ticketId);
        if (!ticket) return json(404, { error: "Ticket not found" });

        const messages = await getMessages(ticketId);
        const latestInbound = [...messages]
            .reverse()
            .find((m) => m.direction === "inbound");

        const fullBody =
            latestInbound?.body ||
            ticket.translatedBody ||
            ticket.summary ||
            ticket.subject ||
            "";

        if (!fullBody.trim()) {
            return json(400, { error: "Not enough ticket content to draft a response" });
        }

        const draftReply = await generateDraftReply(
            ticket.subject || "(No subject)",
            fullBody,
            ticket.from,
            ticket.language || "en"
        );

        const nextTags = Array.from(new Set([...(ticket.tags ?? []), "ai_draft"])) as import("@studyflash/shared").TicketTag[];
        await updateTicket(ticketId, {
            aiDraftReply: draftReply,
            tags: nextTags,
        });

        return json(200, {
            draftReply,
            ticket: await getTicket(ticketId),
        });
    } catch (err) {
        console.error("Draft handler error:", err);
        return json(500, { error: "Internal server error" });
    }
};
