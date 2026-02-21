import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { Client } from "@microsoft/microsoft-graph-client";
import type { AuthenticationProvider } from "@microsoft/microsoft-graph-client";

const ssm = new SSMClient({});

// ── SSM + Token caching ─────────────────────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getParameter(name: string): Promise<string> {
    const result = await ssm.send(
        new GetParameterCommand({ Name: name, WithDecryption: true })
    );
    return result.Parameter!.Value!;
}

async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.value;
    }

    const tenantId = await getParameter("/studyflash/graph/tenant-id");
    const clientId = await getParameter("/studyflash/graph/client-id");
    const clientSecret = await getParameter("/studyflash/graph/client-secret");

    const response = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                scope: "https://graph.microsoft.com/.default",
                grant_type: "client_credentials",
            }),
        }
    );

    const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
    };
    cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
    };
    return cachedToken.value;
}

// ── Graph SDK client ────────────────────────────────────────

const authProvider: AuthenticationProvider = {
    getAccessToken: async () => getAccessToken(),
};

function getGraphClient(): Client {
    return Client.initWithMiddleware({ authProvider });
}

const MAILBOX = process.env.MAILBOX_ADDRESS ?? "support@studyflash.ai";

// ── Mail content ────────────────────────────────────────────

export interface MailContent {
    subject: string;
    body: string;        // plain text (for AI processing)
    htmlBody: string;    // HTML (for frontend rendering)
    from: string;
    fromName?: string;
    conversationId: string;
    hasAttachments: boolean;
    attachments: Array<{
        name: string;
        contentType: string;
        size: number;
        contentId?: string;
    }>;
}

/**
 * Get email content from Graph API (both HTML and plain text).
 */
export async function getMailContent(messageId: string): Promise<MailContent> {
    const client = getGraphClient();

    // Fetch the HTML version (default) with attachments expanded
    const htmlMsg = await client
        .api(`/users/${MAILBOX}/messages/${messageId}`)
        .expand("attachments")
        .select("subject,body,from,conversationId,hasAttachments")
        .get();

    // Fetch the plain text version separately
    const textMsg = await client
        .api(`/users/${MAILBOX}/messages/${messageId}`)
        .header("Prefer", 'outlook.body-content-type="text"')
        .select("body")
        .get();

    // Build attachment metadata and CID→data URI map for inline images
    const cidMap = new Map<string, string>();
    const attachments = (htmlMsg.attachments ?? []).map((a: any) => {
        // If this is an inline attachment with content, build a data URI
        if (a.contentId && a.contentBytes) {
            cidMap.set(a.contentId, `data:${a.contentType};base64,${a.contentBytes}`);
        }
        return {
            name: a.name,
            contentType: a.contentType,
            size: a.size,
            contentId: a.contentId || undefined,
        };
    });

    // Replace cid: references in the HTML with data URIs
    let htmlBody = htmlMsg.body.content as string;
    for (const [cid, dataUri] of cidMap) {
        htmlBody = htmlBody.replace(
            new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
            dataUri
        );
    }

    return {
        subject: htmlMsg.subject,
        htmlBody,
        body: textMsg.body.content.trim(),
        from: htmlMsg.from.emailAddress.address,
        fromName: htmlMsg.from.emailAddress.name || undefined,
        conversationId: htmlMsg.conversationId,
        hasAttachments: htmlMsg.hasAttachments ?? false,
        attachments,
    };
}

// ── Send reply ──────────────────────────────────────────────

/**
 * Send a reply in the same Outlook conversation thread.
 */
export async function sendReply(
    parentMessageId: string,
    body: string
): Promise<string> {
    const client = getGraphClient();

    await client
        .api(`/users/${MAILBOX}/messages/${parentMessageId}/reply`)
        .post({
            message: {
                body: {
                    contentType: "HTML",
                    content: body,
                },
            },
        });

    // Return synthetic ID — Graph doesn't return the new message ID from /reply
    return `reply-${Date.now()}`;
}

// ── Subscription ────────────────────────────────────────────

/**
 * Create a webhook subscription for new emails.
 */
export async function createSubscription(webhookUrl: string): Promise<void> {
    const client = getGraphClient();
    const resource = `users/${MAILBOX}/mailFolders/inbox/messages`;

    console.log(`Creating subscription for resource: ${resource}`);
    console.log(`Notification URL: ${webhookUrl}`);

    const subscription = await client
        .api("/subscriptions")
        .post({
            changeType: "created",
            notificationUrl: webhookUrl,
            resource,
            expirationDateTime: new Date(
                Date.now() + 3 * 24 * 60 * 60 * 1000 // 3 days max
            ).toISOString(),
            clientState:
                process.env.WEBHOOK_SECRET ?? "studyflash-webhook-secret",
        });

    console.log("Graph subscription created:", JSON.stringify(subscription));
}
