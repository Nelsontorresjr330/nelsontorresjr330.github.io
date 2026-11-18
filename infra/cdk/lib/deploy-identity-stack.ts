import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { PortfolioConfig } from './config';

export interface DeployIdentityStackProps extends cdk.StackProps {
  cfg: PortfolioConfig;
}

/**
 * The role GitHub Actions assumes (OIDC, no stored keys). It deploys through the CDK
 * bootstrap roles, uploads the built site, and invalidates CloudFront. Only jobs in the
 * repo's `dev` and `prod` GitHub environments can assume it.
 */
export class DeployIdentityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DeployIdentityStackProps) {
    super(scope, id, props);
    const repo = props.cfg.githubRepo;
    const [owner, name] = repo.split('/');
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this, 'GitHubOidc', `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`);

    const subjects = ['dev', 'prod'].flatMap((env) => [
      `repo:${repo}:environment:${env}`,
      `repo:${owner}@*/${name}@*:environment:${env}`, // GitHub's immutable-id subject form
    ]);

    const role = new iam.Role(this, 'Role', {
      roleName: 'GitHubActions-Portfolio-Deploy',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': subjects },
      }),
    });
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: ['deploy', 'file-publishing', 'lookup'].map(
        (r) => `arn:aws:iam::${this.account}:role/cdk-hnb659fds-${r}-role-${this.account}-*`),
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:*:${this.account}:parameter/cdk-bootstrap/hnb659fds/version`],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudformation:DescribeStacks'],
      resources: [`arn:aws:cloudformation:*:${this.account}:stack/Portfolio-*/*`],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: ['dev', 'prod'].map((s) => `arn:aws:s3:::portfolio-site-${s}-${this.account}`),
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject', 's3:DeleteObject', 's3:GetObject'],
      resources: ['dev', 'prod'].map((s) => `arn:aws:s3:::portfolio-site-${s}-${this.account}/*`),
    }));
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
      resources: [`arn:aws:cloudfront::${this.account}:distribution/*`],
    }));

    new cdk.CfnOutput(this, 'RoleArn', { value: role.roleArn });
  }
}
