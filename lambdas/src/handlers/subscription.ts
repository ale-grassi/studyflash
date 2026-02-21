import type { ScheduledHandler } from "aws-lambda";
import { createSubscription } from "../lib/graph.js";

const WEBHOOK_URL = process.env.WEBHOOK_URL!;

/**
 * Scheduled Lambda that renews the MS Graph webhook subscription.
 * Graph subscriptions expire after max 3 days, so this runs daily.
 */
export const handler: ScheduledHandler = async () => {
    console.log(`Renewing Graph subscription → ${WEBHOOK_URL}`);
    await createSubscription(WEBHOOK_URL);
    console.log("Graph subscription renewed successfully");
};
