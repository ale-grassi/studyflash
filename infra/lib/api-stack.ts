import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2int from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as path from "path";
import type { Construct } from "constructs";

interface ApiStackProps extends cdk.StackProps {
    table: dynamodb.Table;
    queue: sqs.Queue;
}

export class ApiStack extends cdk.Stack {
    public readonly apiUrl: string;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        const { table, queue } = props;

        const runtime = lambda.Runtime.NODEJS_20_X;
        const code = lambda.Code.fromAsset(path.join(__dirname, "../../lambdas/dist"));
        const defaultEnv = {
            TABLE_NAME: table.tableName,
            NODE_OPTIONS: "--enable-source-maps",
        };

        // ── Ticket CRUD Lambda ────────────────────────────────
        const ticketsFn = new lambda.Function(this, "TicketsFn", {
            runtime,
            code,
            handler: "handlers/tickets.handler",
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: defaultEnv,
        });
        table.grantReadWriteData(ticketsFn);

        // ── Reply Lambda ──────────────────────────────────────
        const replyFn = new lambda.Function(this, "ReplyFn", {
            runtime,
            code,
            handler: "handlers/reply.handler",
            timeout: cdk.Duration.seconds(60),
            memorySize: 256,
            environment: { ...defaultEnv, MAILBOX_ADDRESS: "studyflashsupport@aleherz.onmicrosoft.com" },
        });
        table.grantReadWriteData(replyFn);

        // ── Enrichment Lambda ─────────────────────────────────
        const enrichmentFn = new lambda.Function(this, "EnrichmentFn", {
            runtime,
            code,
            handler: "handlers/enrichment.handler",
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: defaultEnv,
        });
        table.grantReadData(enrichmentFn);

        const draftFn = new lambda.Function(this, "DraftFn", {
            runtime,
            code,
            handler: "handlers/draft.handler",
            timeout: cdk.Duration.seconds(60),
            memorySize: 256,
            environment: defaultEnv,
        });
        table.grantReadWriteData(draftFn);
        draftFn.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["bedrock:InvokeModel"],
                resources: ["*"],
            })
        );

        // ── Webhook Lambda ────────────────────────────────────
        const webhookFn = new lambda.Function(this, "WebhookFn", {
            runtime,
            code,
            handler: "handlers/webhook.handler",
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                ...defaultEnv,
                QUEUE_URL: queue.queueUrl,
                MAILBOX_ADDRESS: "studyflashsupport@aleherz.onmicrosoft.com",
            },
        });
        table.grantReadWriteData(webhookFn);
        queue.grantSendMessages(webhookFn);

        // Grant SSM access for MS Graph credentials
        const ssmPolicy = new iam.PolicyStatement({
            actions: ["ssm:GetParameter"],
            resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/studyflash/graph/*`,
            ],
        });
        webhookFn.addToRolePolicy(ssmPolicy);
        replyFn.addToRolePolicy(ssmPolicy);

        // ── HTTP API ──────────────────────────────────────────
        const api = new apigwv2.HttpApi(this, "SupportApi", {
            corsPreflight: {
                allowOrigins: ["*"],
                allowMethods: [
                    apigwv2.CorsHttpMethod.GET,
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.PATCH,
                    apigwv2.CorsHttpMethod.OPTIONS,
                ],
                allowHeaders: ["Content-Type", "Authorization"],
            },
        });

        // Routes
        api.addRoutes({
            path: "/tickets",
            methods: [apigwv2.HttpMethod.GET],
            integration: new apigwv2int.HttpLambdaIntegration(
                "TicketsGet",
                ticketsFn
            ),
        });
        api.addRoutes({
            path: "/tickets/{id}",
            methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PATCH],
            integration: new apigwv2int.HttpLambdaIntegration(
                "TicketsById",
                ticketsFn
            ),
        });
        api.addRoutes({
            path: "/tickets/{id}/reply",
            methods: [apigwv2.HttpMethod.POST],
            integration: new apigwv2int.HttpLambdaIntegration("Reply", replyFn),
        });
        api.addRoutes({
            path: "/tickets/{id}/enrichment",
            methods: [apigwv2.HttpMethod.GET],
            integration: new apigwv2int.HttpLambdaIntegration(
                "Enrichment",
                enrichmentFn
            ),
        });
        api.addRoutes({
            path: "/tickets/{id}/draft",
            methods: [apigwv2.HttpMethod.POST],
            integration: new apigwv2int.HttpLambdaIntegration("Draft", draftFn),
        });
        api.addRoutes({
            path: "/webhook",
            methods: [apigwv2.HttpMethod.POST],
            integration: new apigwv2int.HttpLambdaIntegration(
                "Webhook",
                webhookFn
            ),
        });

        this.apiUrl = api.apiEndpoint;

        new cdk.CfnOutput(this, "ApiUrl", {
            value: api.apiEndpoint,
            description: "Support API endpoint URL",
        });
    }
}
