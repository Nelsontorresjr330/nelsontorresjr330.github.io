#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CertificatesStack } from '../lib/certificates-stack';
import { APP_TAGS, REGION, loadConfig } from '../lib/config';
import { DeployIdentityStack } from '../lib/deploy-identity-stack';
import { SiteStack } from '../lib/site-stack';

// Stacks:
//   Portfolio-DeployIdentity            GitHub Actions OIDC role (shared, deployed by hand once)
//   Portfolio-Certificates-{Dev,Prod}   CloudFront certificates (us-east-1)
//   Portfolio-Site-{Dev,Prod}           S3, CloudFront, DNS (us-east-2)
// CI deploys one stage:  npx cdk deploy "Portfolio-*-Dev" --exclusively
const app = new cdk.App();
const cfg = loadConfig(app);
const account = process.env.CDK_DEFAULT_ACCOUNT;

new DeployIdentityStack(app, 'Portfolio-DeployIdentity', {
  env: { account, region: REGION },
  cfg,
  tags: APP_TAGS,
});

for (const stage of cfg.stages) {
  const tags = { ...APP_TAGS, stage: stage.stage };
  const certs = new CertificatesStack(app, `Portfolio-Certificates-${stage.Stage}`, {
    env: { account, region: 'us-east-1' },
    crossRegionReferences: true,
    cfg,
    stage,
    tags,
  });
  new SiteStack(app, `Portfolio-Site-${stage.Stage}`, {
    env: { account, region: REGION },
    crossRegionReferences: true,
    cfg,
    stage,
    certificate: certs.certificate,
    tags,
  });
}
