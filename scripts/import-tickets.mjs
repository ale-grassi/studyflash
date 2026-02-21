#!/usr/bin/env node
/**
 * import-tickets.mjs
 * ------------------
 * Clears all items from the DynamoDB table and imports ticket files
 * from /tickets, creating a TICKET metadata record + MSG record for each,
 * then queuing it to the AI pipeline via SQS.
 *
 * Usage:  node scripts/import-tickets.mjs
 */

import { DynamoDBClient, ScanCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";

const REGION = "us-east-1";
const TICKETS_DIR = resolve(import.meta.dirname, "..", "tickets");

const TABLE_NAME = "StudyflashDb-SupportTable9EE0E7DF-S4TWON0K1XS6";
const QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/377145790055/StudyflashIngestion-AiPipelineQueueAB7A7074-nVxbqQwBWyIZ";

console.log(`Table:  ${TABLE_NAME}`);
console.log(`Queue:  ${QUEUE_URL}`);

const ddb = new DynamoDBClient({ region: REGION });
const doc = DynamoDBDocumentClient.from(ddb);
const sqs = new SQSClient({ region: REGION });

// ── Step 1: Clear all items ────────────────────────────────
console.log("\n🗑️  Clearing all items from DynamoDB...");
let totalDeleted = 0;
let lastKey = undefined;

do {
    const scan = await ddb.send(
        new ScanCommand({
            TableName: TABLE_NAME,
            ProjectionExpression: "PK, SK",
            ExclusiveStartKey: lastKey,
        })
    );

    const items = scan.Items ?? [];
    lastKey = scan.LastEvaluatedKey;

    // Batch delete in chunks of 25
    for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        await ddb.send(
            new BatchWriteItemCommand({
                RequestItems: {
                    [TABLE_NAME]: batch.map((item) => ({
                        DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
                    })),
                },
            })
        );
        totalDeleted += batch.length;
        process.stdout.write(`\r   Deleted ${totalDeleted} items...`);
    }
} while (lastKey);

console.log(`\n   ✅ Deleted ${totalDeleted} total items.\n`);

// ── Step 2: Parse ticket files ─────────────────────────────

/** Attempt to extract a sender name from the body text */
function extractSender(body) {
    // Look for common sign-off patterns
    const patterns = [
        /(?:(?:Freundliche |Mit freundlichen |Beste |Liebe )?(?:Gr[üu][ßs]e|Grüsse))[\s,]*\n\s*(.+)/i,
        /(?:Cordiali saluti|Cordialmente)[\s,]*\n\s*(.+)/i,
        /(?:Cordialement|Bien [àa] vous|Bien cordialement)[\s,]*\n\s*(.+)/i,
        /(?:Kind regards|Best regards|Regards|Sincerely)[\s,]*\n\s*(.+)/i,
        /(?:Met vriendelijke groeten)[\s,]*\n\s*(.+)/i,
    ];

    for (const pat of patterns) {
        const m = body.match(pat);
        if (m?.[1]) {
            const name = m[1].trim().replace(/\[EMAIL\].*/, "").trim();
            if (name.length > 1 && name.length < 50 && !name.includes("http")) return name;
        }
    }

    return "Unknown Sender";
}

/** Turn file tags into initial ticket tags */
function mapTags(fileTags) {
    const out = [];
    for (const t of fileTags) {
        const lt = t.toLowerCase().trim();
        if (lt === "ai-draft" || lt === "ai") out.push("ai_processed", "ai_draft");
        else if (lt === "auto-closed") out.push("ai_processed", "auto_closed");
        else if (lt === "needs-review") out.push("needs_review");
    }
    // Deduplicate
    return [...new Set(out)];
}

/** Derive a source from the body */
function deriveSource(body) {
    if (body.startsWith("MOBILE:")) return "mobile";
    return "email";
}

/** Extract a subject from the body */
function extractSubject(body, fileNum) {
    // Take the first meaningful line as subject
    const firstLine = body.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
    // Truncate long lines
    if (firstLine.length > 120) return firstLine.slice(0, 120) + "…";
    if (firstLine.length > 5) return firstLine;
    return `Support Ticket #${fileNum}`;
}

// ── Step 3: Import tickets ─────────────────────────────────
const files = (await readdir(TICKETS_DIR)).filter((f) => f.endsWith(".txt")).sort();
console.log(`📥 Importing ${files.length} tickets...\n`);

let imported = 0;
let failed = 0;

for (const file of files) {
    const fileNum = file.replace("ticket_", "").replace(".txt", "");
    const content = await readFile(join(TICKETS_DIR, file), "utf-8");

    // Parse: Tags header, then ---separator, then body
    const sepIdx = content.indexOf("---");
    const header = sepIdx >= 0 ? content.slice(0, sepIdx) : "";
    let body = sepIdx >= 0 ? content.slice(sepIdx + 3).trim() : content.trim();

    // Parse tags
    const tagLine = header.match(/^Tags:\s*(.+)/m)?.[1] ?? "";
    const fileTags = tagLine
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

    // Derive fields
    const source = deriveSource(body);
    if (body.startsWith("MOBILE:")) body = body.slice(7).trim();

    const sender = extractSender(body);
    const subject = extractSubject(body, fileNum);
    const tags = mapTags(fileTags);
    const status = tags.includes("auto_closed") ? "closed" : "open";

    // Generate IDs
    const ticketId = randomUUID();
    const messageId = randomUUID();
    const now = new Date().toISOString();

    // Create ticket record
    const ticket = {
        id: ticketId,
        subject,
        from: sender,
        fromEmail: `ticket${fileNum}@imported.local`,
        status,
        priority: "medium",
        category: "general_how_to", // AI will override
        tags: [],       // AI will override
        language: "en",  // AI will override
        source,
        createdAt: now,
        updatedAt: now,
    };

    try {
        // Write ticket to DynamoDB
        await doc.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `TICKET#${ticketId}`,
                    SK: "METADATA",
                    GSI1PK: "ASSIGNEE#unassigned",
                    GSI1SK: `TICKET#${ticketId}`,
                    GSI2PK: `STATUS#${status}`,
                    GSI2SK: `${now}#TICKET#${ticketId}`,
                    ...ticket,
                },
            })
        );

        // Write message record
        await doc.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    PK: `TICKET#${ticketId}`,
                    SK: `MSG#${now}#${messageId}`,
                    id: messageId,
                    ticketId,
                    direction: "inbound",
                    body,
                    from: sender,
                    timestamp: now,
                },
            })
        );

        // Queue for AI classification
        await sqs.send(
            new SendMessageCommand({
                QueueUrl: QUEUE_URL,
                MessageBody: JSON.stringify({
                    ticketId,
                    subject,
                    body,
                    from: sender,
                    mode: "new",
                    messageId,
                }),
            })
        );

        imported++;
        process.stdout.write(`\r   Imported ${imported}/${files.length} (${file})`);
    } catch (err) {
        failed++;
        console.error(`\n   ❌ Failed ${file}: ${err.message}`);
    }
}

console.log(`\n\n✅ Import complete: ${imported} imported, ${failed} failed.`);
console.log(`⏳ AI pipeline is processing ${imported} tickets in the background via SQS.`);
console.log("   Check CloudWatch logs for classification progress.\n");
