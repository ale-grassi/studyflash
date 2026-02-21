import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEvents from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";
import type { Construct } from "constructs";

interface IngestionStackProps extends cdk.StackProps {
    table: dynamodb.Table;
}

export class IngestionStack extends cdk.Stack {
    public readonly queue: sqs.Queue;

    constructor(scope: Construct, id: string, props: IngestionStackProps) {
        super(scope, id, props);

        const { table } = props;

        // ── Dead Letter Queue ─────────────────────────────────
        const dlq = new sqs.Queue(this, "AiPipelineDLQ", {
            retentionPeriod: cdk.Duration.days(14),
        });

        // ── Main Queue ────────────────────────────────────────
        this.queue = new sqs.Queue(this, "AiPipelineQueue", {
            visibilityTimeout: cdk.Duration.seconds(300), // 5 min for Bedrock calls
            deadLetterQueue: {
                queue: dlq,
                maxReceiveCount: 3,
            },
        });

        // ── AI Pipeline Lambda ────────────────────────────────
        const aiPipelineFn = new lambda.Function(this, "AiPipelineFn", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "handlers/ai-pipeline.handler",
            code: lambda.Code.fromAsset(
                path.join(__dirname, "../../lambdas/dist")
            ),
            timeout: cdk.Duration.seconds(120), // Bedrock model invocation
            memorySize: 256,
            environment: {
                TABLE_NAME: table.tableName,
                NODE_OPTIONS: "--enable-source-maps",
            },
        });

        table.grantReadWriteData(aiPipelineFn);

        // Allow the Lambda to invoke the Bedrock model
        aiPipelineFn.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["bedrock:InvokeModel"],
                resources: ["*"],
            })
        );

        aiPipelineFn.addEventSource(
            new lambdaEvents.SqsEventSource(this.queue, {
                batchSize: 1, // Process one at a time for AI reliability
            })
        );
    }
}
