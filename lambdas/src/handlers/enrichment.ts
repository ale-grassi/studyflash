import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getTicket } from "../lib/dynamodb.js";
import type { EnrichmentData } from "@studyflash/shared";

function json(statusCode: number, body: unknown) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

/**
 * Enrichment handler — fetches contextual data from external services.
 *
 * MVP: returns realistic mock data.
 * Production: would call Sentry API, Posthog API, and Postgres directly.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    try {
        const ticketId = event.pathParameters?.id;
        if (!ticketId) return json(400, { error: "Missing ticket ID" });

        const ticket = await getTicket(ticketId);
        if (!ticket) return json(404, { error: "Ticket not found" });

        // In production, these would be real API calls:
        // const sentryErrors = await fetchSentryErrors(ticket.fromEmail);
        // const sessions = await fetchPosthogSessions(ticket.fromEmail);
        // const userData = await fetchUserData(ticket.fromEmail);

        const enrichment: EnrichmentData = {
            sentryErrors: [
                {
                    title: "TypeError: Cannot read property 'flashcards' of undefined",
                    count: 12,
                    lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    url: "https://sentry.io/studyflash/issue/12345",
                    level: "error",
                },
                {
                    title: "NetworkError: Failed to fetch quiz data",
                    count: 3,
                    lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    url: "https://sentry.io/studyflash/issue/12346",
                    level: "warning",
                },
            ],
            posthogSessions: [
                {
                    sessionId: "ph-session-001",
                    url: "https://app.posthog.com/recordings/ph-session-001",
                    duration: 342,
                    timestamp: new Date(
                        Date.now() - 3 * 60 * 60 * 1000
                    ).toISOString(),
                    pageCount: 8,
                },
            ],
            userData: {
                userId: `user-${ticket.id.slice(0, 8)}`,
                email: ticket.fromEmail,
                name: ticket.from,
                plan: "premium_monthly",
                signupDate: new Date(
                    Date.now() - 90 * 24 * 60 * 60 * 1000
                ).toISOString(),
                lastActive: new Date(
                    Date.now() - 60 * 60 * 1000
                ).toISOString(),
                ticketCount: 2,
                country: "CH",
            },
        };

        return json(200, enrichment);
    } catch (err) {
        console.error("Enrichment handler error:", err);
        return json(500, { error: "Internal server error" });
    }
};
