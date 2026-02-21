import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Ticket, Message } from "@studyflash/shared";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.TABLE_NAME!;

// ── Write ───────────────────────────────────────────────────

export async function putTicket(ticket: Ticket): Promise<void> {
    await docClient.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `TICKET#${ticket.id}`,
                SK: "METADATA",
                GSI1PK: ticket.assigneeId
                    ? `ASSIGNEE#${ticket.assigneeId}`
                    : "ASSIGNEE#unassigned",
                GSI1SK: `TICKET#${ticket.id}`,
                GSI2PK: `STATUS#${ticket.status}`,
                GSI2SK: `${ticket.createdAt}#TICKET#${ticket.id}`,
                ...(ticket.conversationId
                    ? { GSI3PK: `CONV#${ticket.conversationId}` }
                    : {}),
                ...ticket,
            },
        })
    );
}

export async function updateTicket(
    ticketId: string,
    updates: Partial<Pick<Ticket, "status" | "priority" | "assigneeId" | "tags" | "aiDraftReply" | "summary" | "translatedSubject" | "translatedBody" | "category" | "language" | "lastReplySource" | "lastReplyAt">>
): Promise<void> {
    const expressionParts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};

    const now = new Date().toISOString();
    updates = { ...updates }; // clone

    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            const attrName = `#${key}`;
            const attrValue = `:${key}`;
            expressionParts.push(`${attrName} = ${attrValue}`);
            names[attrName] = key;
            values[attrValue] = value;
        }
    }

    expressionParts.push("#updatedAt = :updatedAt");
    names["#updatedAt"] = "updatedAt";
    values[":updatedAt"] = now;

    // Update GSI keys if status or assignee changed
    if (updates.status) {
        expressionParts.push("GSI2PK = :gsi2pk");
        values[":gsi2pk"] = `STATUS#${updates.status}`;
    }
    if (updates.assigneeId !== undefined) {
        expressionParts.push("GSI1PK = :gsi1pk");
        values[":gsi1pk"] = updates.assigneeId
            ? `ASSIGNEE#${updates.assigneeId}`
            : "ASSIGNEE#unassigned";
    }

    await docClient.send(
        new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TICKET#${ticketId}`, SK: "METADATA" },
            UpdateExpression: `SET ${expressionParts.join(", ")}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
        })
    );
}

export async function appendMessage(message: Message): Promise<void> {
    await docClient.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `TICKET#${message.ticketId}`,
                SK: `MSG#${message.timestamp}#${message.id}`,
                ...message,
            },
        })
    );
}

export async function updateMessage(
    ticketId: string,
    messageId: string,
    updates: Partial<Pick<Message, "translatedBody">>
): Promise<void> {
    // Find the message SK by scanning messages for this ticket
    const msgs = await getMessages(ticketId);
    const msg = msgs.find((m) => m.id === messageId);
    if (!msg) return;

    const sk = `MSG#${msg.timestamp}#${msg.id}`;
    const expressionParts: string[] = [];
    const values: Record<string, unknown> = {};

    if (updates.translatedBody !== undefined) {
        expressionParts.push("translatedBody = :tb");
        values[":tb"] = updates.translatedBody;
    }

    if (expressionParts.length === 0) return;

    await docClient.send(
        new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TICKET#${ticketId}`, SK: sk },
            UpdateExpression: `SET ${expressionParts.join(", ")}`,
            ExpressionAttributeValues: values,
        })
    );
}

// ── Deduplication ───────────────────────────────────────────

/**
 * Atomic dedup: tries to write a lock item for this outlookMessageId.
 * Returns true if we claimed it (first writer wins).
 * Returns false if another invocation already claimed it.
 */
export async function claimOutlookMessage(
    outlookMessageId: string
): Promise<boolean> {
    try {
        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `MSGID#${outlookMessageId}`,
                    SK: "LOCK",
                    claimedAt: new Date().toISOString(),
                    ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 day TTL
                },
                ConditionExpression: "attribute_not_exists(PK)",
            })
        );
        return true; // We won the race
    } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
            return false; // Another invocation already claimed it
        }
        throw err; // Unexpected error
    }
}

// ── Read ────────────────────────────────────────────────────

export async function getTicket(ticketId: string): Promise<Ticket | null> {
    const result = await docClient.send(
        new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: `TICKET#${ticketId}`, SK: "METADATA" },
        })
    );
    if (!result.Item) return null;
    const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...ticket } = result.Item;
    return ticket as Ticket;
}

export async function getMessages(ticketId: string): Promise<Message[]> {
    const result = await docClient.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": `TICKET#${ticketId}`,
                ":sk": "MSG#",
            },
            ScanIndexForward: true, // chronological order
        })
    );
    return (result.Items ?? []).map(({ PK, SK, ...msg }) => msg as Message);
}

export async function listTicketsByStatus(
    status: string
): Promise<Ticket[]> {
    const result = await docClient.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "GSI2",
            KeyConditionExpression: "GSI2PK = :pk",
            ExpressionAttributeValues: { ":pk": `STATUS#${status}` },
            ScanIndexForward: false, // newest first
        })
    );
    return (result.Items ?? []).map(
        ({ PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...ticket }) =>
            ticket as Ticket
    );
}

export async function listTicketsByAssignee(
    assigneeId: string
): Promise<Ticket[]> {
    const result = await docClient.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :pk",
            ExpressionAttributeValues: { ":pk": `ASSIGNEE#${assigneeId}` },
        })
    );
    return (result.Items ?? []).map(
        ({ PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...ticket }) =>
            ticket as Ticket
    );
}

export async function getTicketByConversationId(
    conversationId: string
): Promise<Ticket | null> {
    const result = await docClient.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "GSI3",
            KeyConditionExpression: "GSI3PK = :pk",
            ExpressionAttributeValues: { ":pk": `CONV#${conversationId}` },
            Limit: 1,
        })
    );
    if (!result.Items?.length) return null;
    const ticketId = (result.Items[0].PK as string).replace("TICKET#", "");
    return getTicket(ticketId);
}

export async function listAllTickets(): Promise<Ticket[]> {
    // Read all workflow statuses from GSI2.
    const statuses = ["open", "in_progress", "waiting", "resolved", "closed"];
    const results = await Promise.all(statuses.map((s) => listTicketsByStatus(s)));
    const allTickets = results.flat();
    return allTickets.sort(
        (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}
