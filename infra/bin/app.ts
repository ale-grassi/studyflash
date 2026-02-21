#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DatabaseStack } from "../lib/database-stack";
import { ApiStack } from "../lib/api-stack";
import { IngestionStack } from "../lib/ingestion-stack";
import { FrontendStack } from "../lib/frontend-stack";

import { SubscriptionStack } from "../lib/subscription-stack";

const app = new cdk.App();

const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

const db = new DatabaseStack(app, "StudyflashDb", { env });

const ingestion = new IngestionStack(app, "StudyflashIngestion", {
    env,
    table: db.table,
});

const api = new ApiStack(app, "StudyflashApi", {
    env,
    table: db.table,
    queue: ingestion.queue,
});

new SubscriptionStack(app, "StudyflashSubscription", {
    env,
    webhookUrl: `${api.apiUrl}/webhook`,
});

new FrontendStack(app, "StudyflashFrontend", { env });

