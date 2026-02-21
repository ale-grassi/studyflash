import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { putTicket, appendMessage, getTicket, updateTicket, claimOutlookMessage, getTicketByConversationId } from "../lib/dynamodb.js";
import { getMailContent, sendReply } from "../lib/graph.js";
import { detectLanguage } from "../lib/bedrock.js";
import { v4 as uuid } from "uuid";
import type { Ticket, Message } from "@studyflash/shared";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.QUEUE_URL!;
const MAILBOX_ADDRESS = (process.env.MAILBOX_ADDRESS ?? "").toLowerCase();

// ── Fixed auto-ack templates per language ───────────────────
const AUTO_ACK_TEMPLATES: Record<string, (name: string) => string> = {
    en: (name) =>
        `Hello ${name},<br/><br/>Thank you for contacting us. We have received your request and a team member will get back to you as soon as possible.<br/><br/>Best regards,<br/>Studyflash Team`,
    de: (name) =>
        `Hallo ${name},<br/><br/>vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und ein Teammitglied wird sich so schnell wie möglich bei Ihnen melden.<br/><br/>Mit freundlichen Grüßen,<br/>Studyflash Team`,
    fr: (name) =>
        `Bonjour ${name},<br/><br/>Merci de nous avoir contactés. Nous avons bien reçu votre demande et un membre de notre équipe vous répondra dans les plus brefs délais.<br/><br/>Cordialement,<br/>L'équipe Studyflash`,
    it: (name) =>
        `Ciao ${name},<br/><br/>Grazie per averci contattato. Abbiamo ricevuto la tua richiesta e un membro del team ti risponderà il prima possibile.<br/><br/>Cordiali saluti,<br/>Il team Studyflash`,
    es: (name) =>
        `Hola ${name},<br/><br/>Gracias por contactarnos. Hemos recibido tu solicitud y un miembro del equipo te responderá lo antes posible.<br/><br/>Saludos cordiales,<br/>Equipo Studyflash`,
    pt: (name) =>
        `Olá ${name},<br/><br/>Obrigado por nos contactar. Recebemos o seu pedido e um membro da equipa entrará em contacto consigo o mais brevemente possível.<br/><br/>Com os melhores cumprimentos,<br/>Equipa Studyflash`,
    nl: (name) =>
        `Hallo ${name},<br/><br/>Bedankt voor uw bericht. We hebben uw verzoek ontvangen en een teamlid zal zo snel mogelijk contact met u opnemen.<br/><br/>Met vriendelijke groet,<br/>Studyflash Team`,
};

function getAutoAck(displayName: string, language: string): string {
    const template = AUTO_ACK_TEMPLATES[language] ?? AUTO_ACK_TEMPLATES.en!;
    return template(displayName);
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getDisplayName(fromEmail: string, fromName?: string): string {
    const raw = (fromName ?? "").trim();
    if (raw.length > 0) return raw;
    const localPart = fromEmail.split("@")[0] ?? "there";
    return localPart
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function json(statusCode: number, body: unknown) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

/**
 * MS Graph webhook handler.
 *
 * Two flows:
 * 1. Subscription validation: Graph sends ?validationToken=... → echo it back
 * 2. Change notification: new email → ingest, store, queue for AI
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    // ── Subscription validation ─────────────────────────────
    const validationToken =
        event.queryStringParameters?.validationToken;
    if (validationToken) {
        return {
            statusCode: 200,
            headers: { "Content-Type": "text/plain" },
            body: validationToken,
        };
    }

    // ── Change notification ─────────────────────────────────
    try {
        const body = JSON.parse(event.body ?? "{}");
        const notifications = body.value ?? [];

        for (const notification of notifications) {
            const messageId = notification.resourceData?.id;
            if (!messageId) continue;

            // Verify client state
            if (
                notification.clientState !==
                (process.env.WEBHOOK_SECRET ?? "studyflash-webhook-secret")
            ) {
                console.warn("Invalid client state, skipping notification");
                continue;
            }

            // ── Atomic deduplication: only first writer wins ──
            const claimed = await claimOutlookMessage(messageId);
            if (!claimed) {
                console.log(`Skipping duplicate notification for messageId: ${messageId}`);
                continue;
            }

            // Fetch full email content from Graph
            const mail = await getMailContent(messageId);
            const sender = (mail.from ?? "").toLowerCase().trim();
            if (
                sender === MAILBOX_ADDRESS ||
                sender.includes("mailer-daemon") ||
                sender.includes("postmaster") ||
                sender.includes("no-reply") ||
                sender.includes("noreply")
            ) {
                console.log(`Skipping system sender: ${mail.from}`);
                continue;
            }

            // Check if this belongs to an existing conversation
            const existingTicket = mail.conversationId
                ? await getTicketByConversationId(mail.conversationId)
                : null;

            if (existingTicket) {
                // ── Append to existing thread ──────────────────
                const msgId = uuid();
                const message: Message = {
                    id: msgId,
                    ticketId: existingTicket.id,
                    direction: "inbound",
                    body: mail.body,
                    htmlBody: mail.htmlBody,
                    from: mail.from,
                    outlookMessageId: messageId,
                    timestamp: new Date().toISOString(),
                };
                await appendMessage(message);

                // Re-open the ticket so agents notice the new reply
                if (existingTicket.status === "waiting" || existingTicket.status === "resolved" || existingTicket.status === "closed") {
                    await updateTicket(existingTicket.id, { status: "open" });
                }

                // Queue for AI summary update
                await sqs.send(
                    new SendMessageCommand({
                        QueueUrl: QUEUE_URL,
                        MessageBody: JSON.stringify({
                            ticketId: existingTicket.id,
                            subject: existingTicket.subject,
                            body: mail.body,
                            from: mail.from,
                            mode: "update",
                            messageId: msgId,
                            language: existingTicket.language,
                        }),
                    })
                );

                console.log(`Appended reply to existing ticket ${existingTicket.id} (conv: ${mail.conversationId})`);
            } else {
                // ── New conversation → create ticket ──────────
                const ticketId = uuid();
                const msgId = uuid();
                const now = new Date().toISOString();
                const source = mail.body.startsWith("MOBILE:") ? "mobile" : "email";

                // Detect language for auto-ack before full AI pipeline
                let detectedLang = "en";
                try {
                    detectedLang = await detectLanguage(mail.subject, mail.body, mail.from);
                } catch (langErr) {
                    console.error("Language detection failed, defaulting to en:", langErr);
                }

                const ticket: Ticket = {
                    id: ticketId,
                    subject: mail.subject,
                    from: mail.from,
                    fromEmail: mail.from,
                    status: "open",
                    priority: "medium", // AI will refine
                    category: "general_how_to", // AI will refine
                    tags: [],
                    language: detectedLang,
                    source: source as "web" | "mobile" | "email",
                    conversationId: mail.conversationId,
                    outlookMessageId: messageId,
                    createdAt: now,
                    updatedAt: now,
                };

                await putTicket(ticket);

                // Store the initial message
                const message: Message = {
                    id: msgId,
                    ticketId,
                    direction: "inbound",
                    body: mail.body,
                    htmlBody: mail.htmlBody,
                    from: mail.from,
                    outlookMessageId: messageId,
                    timestamp: now,
                };
                await appendMessage(message);

                // Immediate auto-acknowledgement in the user's language
                try {
                    const displayName = escapeHtml(getDisplayName(mail.from, mail.fromName));
                    const autoAck = getAutoAck(displayName, detectedLang);
                    await sendReply(messageId, autoAck);
                } catch (ackErr) {
                    console.error(`Failed auto-ack for message ${messageId}:`, ackErr);
                }

                // Queue for AI processing
                await sqs.send(
                    new SendMessageCommand({
                        QueueUrl: QUEUE_URL,
                        MessageBody: JSON.stringify({
                            ticketId,
                            subject: mail.subject,
                            body: mail.body,
                            from: mail.from,
                            mode: "new",
                            messageId: msgId,
                        }),
                    })
                );
            }
        }

        // Must return 202 quickly — Graph retries on slow responses
        return json(202, { status: "accepted" });
    } catch (err) {
        console.error("Webhook handler error:", err);
        return json(202, { status: "accepted" }); // Still return 202 to prevent retries
    }
};
