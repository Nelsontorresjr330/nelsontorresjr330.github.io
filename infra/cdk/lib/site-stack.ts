import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { PortfolioConfig, StageConfig } from './config';

export interface SiteStackProps extends cdk.StackProps {
  cfg: PortfolioConfig;
  stage: StageConfig;
  certificate: acm.ICertificate;
}

const FUNCTIONS_DIR = path.join(__dirname, '..', 'functions');

/** Fills the site request function's placeholders. Exported for the tests. */
export function siteFunctionCode(canonicalHost: string, redirects: Record<string, string>): string {
  return fs
    .readFileSync(path.join(FUNCTIONS_DIR, 'site-request.js'), 'utf8')
    .replace("var CANONICAL_HOST = '__CANONICAL_HOST__';", `var CANONICAL_HOST = ${JSON.stringify(canonicalHost)};`)
    .replace('var REDIRECTS = __REDIRECTS__;', `var REDIRECTS = ${JSON.stringify(redirects)};`);
}

/**
 * The portfolio for one stage: a private S3 bucket behind CloudFront (Origin Access Control),
 * a viewer-request function for canonical host, redirects and React routes, research demo APIs
 * proxied under /api/<name>/*, and DNS records.
 */
export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);
    const { cfg, stage, certificate } = props;

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: stage.bucketName(this.account),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: stage.stage === 'prod',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const siteFunction = new cloudfront.Function(this, 'SiteRequestFunction', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: `Canonical host, redirects and React routes for ${stage.canonicalHost}`,
      code: cloudfront.FunctionCode.fromInline(siteFunctionCode(stage.canonicalHost, stage.redirects)),
    });
    const apiFunction = new cloudfront.Function(this, 'ApiRequestFunction', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'Strip /api/<demo> before forwarding to the demo API',
      code: cloudfront.FunctionCode.fromFile({ filePath: path.join(FUNCTIONS_DIR, 'api-request.js') }),
    });

    const headers = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        strictTransportSecurity: { accessControlMaxAge: cdk.Duration.days(365), includeSubdomains: true, override: true },
        contentTypeOptions: { override: true },
        // SAMEORIGIN, not DENY: Storybook (dev) renders stories in a same-origin iframe.
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
      },
      customHeadersBehavior: stage.noindex
        ? { customHeaders: [{ header: 'X-Robots-Tag', value: 'noindex, nofollow', override: true }] }
        : undefined,
    });

    const additionalBehaviors: Record<string, cloudfront.BehaviorOptions> = {};
    for (const [name, host] of Object.entries(cfg.demoApis)) {
      additionalBehaviors[`/api/${name}/*`] = {
        origin: new origins.HttpOrigin(host, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        responseHeadersPolicy: headers,
        functionAssociations: [{ function: apiFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      };
    }

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Portfolio (${stage.stage})`,
      domainNames: stage.hosts,
      certificate,
      defaultRootObject: 'index.html',
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: headers,
        compress: true,
        functionAssociations: [{ function: siteFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors,
    });

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: cfg.hostedZoneId,
      zoneName: cfg.domain,
    });
    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
    stage.hosts.forEach((host, i) => {
      const recordName = host === cfg.domain ? undefined : host.slice(0, -(cfg.domain.length + 1));
      new route53.ARecord(this, `A${i}`, { zone, recordName, target });
      new route53.AaaaRecord(this, `Aaaa${i}`, { zone, recordName, target });
    });

    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${stage.canonicalHost}` });
  }
}
