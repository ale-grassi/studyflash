import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "path";
import type { Construct } from "constructs";

interface SubscriptionStackProps extends cdk.StackProps {
    webhookUrl: string;
}

export class SubscriptionStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SubscriptionStackProps) {
        super(scope, id, props);

        const { webhookUrl } = props;

        // ── Subscription Renewal Lambda ──────────────────────
        const subscriptionFn = new lambda.Function(this, "SubscriptionFn", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "handlers/subscription.handler",
            code: lambda.Code.fromAsset(
                path.join(__dirname, "../../lambdas/dist")
            ),
            functionName: "studyflash-graph-subscription",
            timeout: cdk.Duration.seconds(30),
            memorySize: 128,
            environment: {
                WEBHOOK_URL: webhookUrl,
                MAILBOX_ADDRESS: "studyflashsupport@aleherz.onmicrosoft.com",
                NODE_OPTIONS: "--enable-source-maps",
            },
        });

        // Grant SSM access for MS Graph credentials
        subscriptionFn.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["ssm:GetParameter"],
                resources: [
                    `arn:aws:ssm:${this.region}:${this.account}:parameter/studyflash/graph/*`,
                ],
            })
        );

        // ── Daily schedule ───────────────────────────────────
        const rule = new events.Rule(this, "DailyRenewal", {
            schedule: events.Schedule.rate(cdk.Duration.days(1)),
            description: "Renew MS Graph webhook subscription daily",
        });
        rule.addTarget(new targets.LambdaFunction(subscriptionFn));
    }
}
