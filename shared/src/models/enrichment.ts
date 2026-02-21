import { z } from "zod";

export const SentryErrorSchema = z.object({
    title: z.string(),
    count: z.number(),
    lastSeen: z.string().datetime(),
    url: z.string().url(),
    level: z.enum(["error", "warning", "info"]),
});
export type SentryError = z.infer<typeof SentryErrorSchema>;

export const PosthogSessionSchema = z.object({
    sessionId: z.string(),
    url: z.string().url(),
    duration: z.number(), // seconds
    timestamp: z.string().datetime(),
    pageCount: z.number(),
});
export type PosthogSession = z.infer<typeof PosthogSessionSchema>;

export const UserDataSchema = z.object({
    userId: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    plan: z.enum(["free", "premium_monthly", "premium_yearly"]),
    signupDate: z.string().datetime(),
    lastActive: z.string().datetime(),
    ticketCount: z.number(),
    country: z.string().optional(),
});
export type UserData = z.infer<typeof UserDataSchema>;

export const EnrichmentDataSchema = z.object({
    sentryErrors: z.array(SentryErrorSchema),
    posthogSessions: z.array(PosthogSessionSchema),
    userData: UserDataSchema.optional(),
});
export type EnrichmentData = z.infer<typeof EnrichmentDataSchema>;
