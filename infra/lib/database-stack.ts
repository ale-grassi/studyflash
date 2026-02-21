import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

export class DatabaseStack extends cdk.Stack {
    public readonly table: dynamodb.Table;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.table = new dynamodb.Table(this, "SupportTable", {
            partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
        });

        // GSI1: Query tickets by assignee
        this.table.addGlobalSecondaryIndex({
            indexName: "GSI1",
            partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // GSI2: Query tickets by status (sorted by creation time)
        this.table.addGlobalSecondaryIndex({
            indexName: "GSI2",
            partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // GSI3: Lookup ticket by Outlook conversationId
        this.table.addGlobalSecondaryIndex({
            indexName: "GSI3",
            partitionKey: { name: "GSI3PK", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.KEYS_ONLY,
        });
    }
}
