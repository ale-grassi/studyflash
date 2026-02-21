import type {
    APIGatewayProxyHandlerV2,
    APIGatewayProxyEventV2,
} from "aws-lambda";
import {
    getTicket,
    getMessages,
    listAllTickets,
    listTicketsByStatus,
    listTicketsByAssignee,
    updateTicket,
} from "../lib/dynamodb.js";
import { UpdateTicketSchema } from "@studyflash/shared";

function json(statusCode: number, body: unknown) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    try {
        // GET /tickets
        if (method === "GET" && path === "/tickets") {
            const params = event.queryStringParameters ?? {};

            let tickets;
            if (params.status) {
                tickets = await listTicketsByStatus(params.status);
            } else if (params.assigneeId) {
                tickets = await listTicketsByAssignee(params.assigneeId);
            } else {
                tickets = await listAllTickets();
            }

            // Client-side search filter (MVP — in prod, use OpenSearch)
            if (params.search) {
                const q = params.search.toLowerCase();
                tickets = tickets.filter(
                    (t) =>
                        t.subject.toLowerCase().includes(q) ||
                        t.from.toLowerCase().includes(q) ||
                        t.summary?.toLowerCase().includes(q)
                );
            }

            return json(200, { tickets, count: tickets.length });
        }

        // GET /tickets/{id}
        const ticketMatch = path.match(/^\/tickets\/([^/]+)$/);
        if (method === "GET" && ticketMatch) {
            const ticketId = ticketMatch[1];
            const [ticket, messages] = await Promise.all([
                getTicket(ticketId),
                getMessages(ticketId),
            ]);

            if (!ticket) return json(404, { error: "Ticket not found" });
            return json(200, { ticket, messages });
        }

        // PATCH /tickets/{id}
        if (method === "PATCH" && ticketMatch) {
            const ticketId = ticketMatch[1];
            const body = JSON.parse(event.body ?? "{}");
            const parsed = UpdateTicketSchema.parse(body);
            const updates = { ...parsed, assigneeId: parsed.assigneeId ?? undefined };
            await updateTicket(ticketId, updates);
            const updated = await getTicket(ticketId);
            return json(200, { ticket: updated });
        }

        return json(404, { error: "Not found" });
    } catch (err) {
        console.error("Ticket handler error:", err);
        return json(500, { error: "Internal server error" });
    }
};
