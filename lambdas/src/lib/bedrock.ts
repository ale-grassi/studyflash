import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { TEAM_MEMBERS } from "@studyflash/shared";
import type { TicketCategory, TicketPriority } from "@studyflash/shared";

const bedrock = new BedrockRuntimeClient({});

const MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const SUPPORTED_LANGUAGE_CODES = new Set([
    "de",
    "fr",
    "it",
    "nl",
    "en",
    "es",
    "pt",
]);
const CATEGORY_VALUES: TicketCategory[] = [
    "subscription_cancellation",
    "refund_request",
    "billing_invoice",
    "flashcard_issues",
    "quiz_issues",
    "content_upload",
    "language_issues",
    "technical_errors",
    "account_issues",
    "podcast_issues",
    "summary_issues",
    "mock_exam_issues",
    "mindmap_issues",
    "general_how_to",
    "data_loss",
    "misunderstanding",
    "garbage",
];
const PRIORITY_VALUES: TicketPriority[] = ["critical", "high", "medium", "low"];
const ASSIGNEE_VALUES = TEAM_MEMBERS.filter((m) => m.id !== "unassigned").map((m) => m.id);

const LANGUAGE_SCHEMA = {
    type: "object",
    properties: {
        language: {
            type: "string",
            enum: Array.from(SUPPORTED_LANGUAGE_CODES),
        },
        confidence: { type: "number" },
    },
    required: ["language", "confidence"],
    additionalProperties: false,
} as const;

const CLASSIFICATION_SCHEMA = {
    type: "object",
    properties: {
        category: { type: "string", enum: CATEGORY_VALUES },
        priority: { type: "string", enum: PRIORITY_VALUES },
        language: { type: "string", enum: Array.from(SUPPORTED_LANGUAGE_CODES) },
        summary: { type: "string" },
        translatedSubject: { type: "string" },
        translatedBody: { type: "string" },
        suggestedAssignee: { type: "string", enum: ASSIGNEE_VALUES },
        draftReply: { type: "string" },
        shouldAutoClose: { type: "boolean" },
    },
    required: [
        "category",
        "priority",
        "language",
        "summary",
        "translatedSubject",
        "translatedBody",
        "suggestedAssignee",
        "draftReply",
        "shouldAutoClose",
    ],
    additionalProperties: false,
} as const;

const DRAFT_SCHEMA = {
    type: "object",
    properties: {
        draftReply: { type: "string" },
    },
    required: ["draftReply"],
    additionalProperties: false,
} as const;

const UPDATE_SUMMARY_SCHEMA = {
    type: "object",
    properties: {
        summary: { type: "string" },
        translatedBody: { type: "string" },
    },
    required: ["summary", "translatedBody"],
    additionalProperties: false,
} as const;

const TRANSLATION_SCHEMA = {
    type: "object",
    properties: {
        translatedText: { type: "string" },
    },
    required: ["translatedText"],
    additionalProperties: false,
} as const;

export interface ClassificationResult {
    category: TicketCategory;
    priority: TicketPriority;
    language: string;
    summary: string;
    translatedSubject: string;
    translatedBody: string;
    suggestedAssignee: string;
    draftReply: string;
    shouldAutoClose: boolean;
}

const TEAM_CONTEXT = TEAM_MEMBERS
    .filter((m) => m.id !== "unassigned")
    .map((m) => `- ${m.id} (${m.name}): ${m.role}`)
    .join("\n");

const LANGUAGE_SYSTEM_PROMPT = `You detect the language of support tickets.
Return JSON only.

Return valid JSON matching this exact schema:
{
  "language": "<ISO 639-1 lowercase code: de|fr|it|nl|en|es|pt>",
  "confidence": <number from 0 to 1>
}

Rules:
- Detect from the customer's original text in the ticket.
- Ignore quoted history/signatures/disclaimers when possible.
- Prefer the dominant customer language if mixed.
- Do not return language names like "English"; return only the ISO code.`;

const CLASSIFICATION_SYSTEM_PROMPT = `You are the AI triage engine for Studyflash's support platform.
Studyflash is a study app that lets students create flashcards, summaries, quizzes, podcasts, and mindmaps from their course materials using AI.

Your job: analyze each incoming support ticket and return structured JSON.

## Team Members
${TEAM_CONTEXT}

## Routing Rules
- refund_request, subscription_cancellation, billing_invoice → support role
- flashcard_issues, quiz_issues, content_upload, language_issues, summary_issues, mock_exam_issues, mindmap_issues, podcast_issues → support role
- technical_errors, data_loss → engineering role
- account_issues → support role
- misunderstanding, general_how_to → support role
- garbage (spam, empty, nonsensical) → auto-close, no draft needed

## Priority Rules
- critical: data loss, billing disputes with legal threats
- high: refund requests, bugs blocking core functionality
- medium: feature issues, subscription cancellations
- low: general questions, how-to, misunderstandings, garbage

## Draft Reply Guidelines
- Reply in the SAME LANGUAGE as the original ticket
- Be empathetic, professional, use the Studyflash brand voice
- For refund/cancellation: acknowledge, explain process, offer help
- For bugs: acknowledge, ask for reproduction steps if missing
- For garbage/spam: leave draftReply as empty string

Return valid JSON matching this exact schema:
{
  "category": "<one of the TicketCategory values>",
  "priority": "critical|high|medium|low",
  "language": "<ISO 639-1 code: de, fr, it, nl, en, etc>",
  "summary": "<1-2 sentence summary in English>",
  "translatedSubject": "<subject translated to English, or original if already English>",
  "translatedBody": "<full translation to English, or original if already English>",
  "suggestedAssignee": "<team member id>",
  "draftReply": "<draft reply in the original ticket language>",
  "shouldAutoClose": <true if garbage/spam, false otherwise>
}`;

const DRAFT_SYSTEM_PROMPT = `You write customer support email drafts for Studyflash.
Return JSON only.

Rules:
- Reply in the language specified by RequestedLanguage.
- Keep a professional and empathetic tone.
- Be short and actionable (max 4 short sentences).
- Include one short sentence that this is an automatic response and a teammate will follow up as soon as possible.
- If the user asks for cancellation/refund, acknowledge and explain next steps.
- If key details are missing for troubleshooting, ask for them clearly.

Return valid JSON matching this exact schema:
{
  "draftReply": "<full draft response>"
}`;

function extractLatestCustomerText(rawBody: string): string {
    const body = rawBody
        .replace(/^MOBILE:\s*/i, "")
        .replace(/\r\n/g, "\n")
        .trim();

    if (!body) return "";

    const stopPattern = [
        /^on .+wrote:\s*$/i,
        /^from:\s*/i,
        /^sent:\s*/i,
        /^subject:\s*/i,
        /^to:\s*/i,
        /^cc:\s*/i,
        /^-{2,}\s*original message\s*-{2,}$/i,
        /^_{5,}\s*$/i,
    ];

    const lines = body.split("\n");
    const kept: string[] = [];
    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line.startsWith(">")) break;
        if (stopPattern.some((rx) => rx.test(line.trim()))) break;
        kept.push(line);
        if (kept.length >= 60) break;
    }

    return kept.join("\n").trim() || body.slice(0, 2500).trim();
}

function normalizeLanguageCode(value: string | undefined | null): string | null {
    if (!value) return null;

    const normalized = value.trim().toLowerCase();
    if (SUPPORTED_LANGUAGE_CODES.has(normalized)) return normalized;

    const baseCode = normalized.split(/[-_]/)[0];
    if (SUPPORTED_LANGUAGE_CODES.has(baseCode)) return baseCode;

    const byName: Record<string, string> = {
        english: "en",
        german: "de",
        french: "fr",
        italian: "it",
        dutch: "nl",
        spanish: "es",
        portuguese: "pt",
    };
    return byName[normalized] ?? null;
}

async function invokeClaudeJSON<T>(
    systemPrompt: string,
    userContent: string,
    maxTokens: number,
    schema: object
): Promise<T> {
    const command = new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: maxTokens,
            temperature: 0,
            system: systemPrompt,
            output_config: {
                format: {
                    type: "json_schema",
                    schema,
                },
            },
            messages: [
                {
                    role: "user",
                    content: userContent,
                },
            ],
        }),
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const text = (responseBody.content ?? [])
        .map((block: { text?: string }) => block?.text ?? "")
        .join("\n")
        .trim();

    const cleaned = text.startsWith("```")
        ? text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
        : text;

    return JSON.parse(cleaned) as T;
}

export async function detectLanguage(
    subject: string,
    body: string,
    from: string
): Promise<string> {
    const latestText = extractLatestCustomerText(body);
    const result = await invokeClaudeJSON<{ language: string; confidence: number }>(
        LANGUAGE_SYSTEM_PROMPT,
        `Use only this latest customer message text for language detection.\n\n${latestText}\n\nFallback context only if text is empty:\nFrom: ${from}\nSubject: ${subject}`,
        128,
        LANGUAGE_SCHEMA
    );

    return normalizeLanguageCode(result.language) ?? "en";
}

export async function classifyAndDraft(
    subject: string,
    body: string,
    from: string
): Promise<ClassificationResult> {
    const latestText = extractLatestCustomerText(body);
    const detectedLanguage = await detectLanguage(subject, body, from);

    const result = await invokeClaudeJSON<ClassificationResult>(
        CLASSIFICATION_SYSTEM_PROMPT,
        `DetectedLanguage: ${detectedLanguage}\nFrom: ${from}\nSubject: ${subject}\n\nLatestCustomerMessage:\n${latestText}\n\nFullMessage:\n${body}\n\nUse DetectedLanguage as the ticket language and draft reply language. Use LatestCustomerMessage as the primary user intent.`,
        1024,
        CLASSIFICATION_SCHEMA
    );

    const normalized = normalizeLanguageCode(result.language);
    return {
        ...result,
        language: normalized ?? detectedLanguage,
    };
}

export async function generateDraftReply(
    subject: string,
    body: string,
    from: string,
    requestedLanguage: string
): Promise<string> {
    const latestText = extractLatestCustomerText(body);
    const normalizedLanguage = normalizeLanguageCode(requestedLanguage) ?? "en";

    const result = await invokeClaudeJSON<{ draftReply: string }>(
        DRAFT_SYSTEM_PROMPT,
        `RequestedLanguage: ${normalizedLanguage}\nFrom: ${from}\nSubject: ${subject}\n\nLatestCustomerMessage:\n${latestText}\n\nFullMessage:\n${body}`,
        700,
        DRAFT_SCHEMA
    );

    return (result.draftReply ?? "").trim();
}

const UPDATE_SUMMARY_SYSTEM_PROMPT = `You are the AI triage engine for Studyflash's support platform.
You are updating the summary for an ongoing conversation.

Return valid JSON matching the schema:
{
  "summary": "<1-2 sentence English summary covering the FULL conversation so far>",
  "translatedBody": "<English translation of ONLY the latest inbound customer message, or the original if already English>"
}

Rules:
- The summary must cover the entire conversation thread, not just the latest message.
- translatedBody is ONLY the latest inbound message, translated to English.
- Keep the summary concise but comprehensive.`;

export async function updateSummary(
    messages: Array<{ direction: string; body: string; from: string }>,
    subject: string,
    language: string
): Promise<{ summary: string; translatedBody: string }> {
    const thread = messages
        .map((m, i) => `[${m.direction.toUpperCase()} #${i + 1}] From: ${m.from}\n${m.body}`)
        .join("\n\n---\n\n");

    const latestInbound = [...messages].reverse().find((m) => m.direction === "inbound");
    const latestText = latestInbound ? extractLatestCustomerText(latestInbound.body) : "";

    return invokeClaudeJSON<{ summary: string; translatedBody: string }>(
        UPDATE_SUMMARY_SYSTEM_PROMPT,
        `TicketLanguage: ${language}\nSubject: ${subject}\n\nFull conversation thread:\n${thread}\n\nLatest inbound message to translate:\n${latestText}`,
        512,
        UPDATE_SUMMARY_SCHEMA
    );
}

const TRANSLATE_SYSTEM_PROMPT = `You translate support replies to the customer's language.
Return JSON only.

Rules:
- Translate the text accurately to the target language.
- Preserve the tone and formatting.
- If the text is already in the target language, return it unchanged.

Return valid JSON matching this schema:
{
  "translatedText": "<translated text>"
}`;

export async function translateToLanguage(
    text: string,
    targetLanguage: string
): Promise<string> {
    const result = await invokeClaudeJSON<{ translatedText: string }>(
        TRANSLATE_SYSTEM_PROMPT,
        `TargetLanguage: ${targetLanguage}\n\nText to translate:\n${text}`,
        1024,
        TRANSLATION_SCHEMA
    );
    return (result.translatedText ?? text).trim();
}
