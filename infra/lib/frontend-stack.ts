import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as path from "path";
import type { Construct } from "constructs";

export class FrontendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // ── S3 Bucket ─────────────────────────────────────────
        const bucket = new s3.Bucket(this, "FrontendBucket", {
            bucketName: `studyflash-support-frontend-${this.account}`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // ── CloudFront ────────────────────────────────────────
        const distribution = new cloudfront.Distribution(this, "FrontendCDN", {
            defaultBehavior: {
                origin:
                    origins.S3BucketOrigin.withOriginAccessControl(bucket),
                viewerProtocolPolicy:
                    cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: "index.html",
            // SPA fallback: route all 404s to index.html
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                },
            ],
        });

        // ── Deploy static assets ──────────────────────────────
        new s3deploy.BucketDeployment(this, "DeployFrontend", {
            sources: [
                s3deploy.Source.asset(
                    path.join(__dirname, "../../frontend/build")
                ),
            ],
            destinationBucket: bucket,
            distribution,
            distributionPaths: ["/*"],
        });

        new cdk.CfnOutput(this, "FrontendUrl", {
            value: `https://${distribution.distributionDomainName}`,
            description: "Support platform URL",
        });
    }
}
