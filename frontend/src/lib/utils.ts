import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(date: string | Date): string {
    return new Date(date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export const PRIORITY_COLORS: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
};

export const STATUS_COLORS: Record<string, string> = {
    open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    in_progress: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    waiting: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    resolved: "bg-green-500/20 text-green-400 border-green-500/30",
    closed: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export const CATEGORY_LABELS: Record<string, string> = {
    subscription_cancellation: "Subscription Cancel",
    refund_request: "Refund",
    billing_invoice: "Billing",
    flashcard_issues: "Flashcards",
    quiz_issues: "Quiz",
    content_upload: "Upload",
    language_issues: "Language",
    technical_errors: "Technical",
    account_issues: "Account",
    podcast_issues: "Podcast",
    summary_issues: "Summary",
    mock_exam_issues: "Mock Exam",
    mindmap_issues: "Mindmap",
    general_how_to: "How-To",
    data_loss: "Data Loss",
    misunderstanding: "Misunderstanding",
    garbage: "Spam/Garbage",
};

export const LANGUAGE_FLAGS: Record<string, string> = {
    de: "🇩🇪",
    fr: "🇫🇷",
    it: "🇮🇹",
    nl: "🇳🇱",
    en: "🇬🇧",
    es: "🇪🇸",
    pt: "🇵🇹",
};
