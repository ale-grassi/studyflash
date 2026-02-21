import { z } from "zod";

export const TeamMemberSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.enum(["admin", "support", "engineering", "product"]),
    avatarUrl: z.string().optional(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

// MVP: hardcoded team — replace with Cognito/directory lookup in prod
export const TEAM_MEMBERS: TeamMember[] = [
    {
        id: "max",
        name: "Maximilian",
        email: "max@studyflash.ai",
        role: "support",
    },
    {
        id: "alicia",
        name: "Alicia",
        email: "alicia@studyflash.ai",
        role: "support",
    },
    {
        id: "alessandro",
        name: "Alessandro",
        email: "alessandro@studyflash.ai",
        role: "engineering",
    },
    {
        id: "unassigned",
        name: "Unassigned",
        email: "support@studyflash.ai",
        role: "admin",
    },
];
