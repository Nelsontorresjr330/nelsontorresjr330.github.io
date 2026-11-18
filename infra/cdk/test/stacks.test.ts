import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { CertificatesStack } from '../lib/certificates-stack';
import { loadConfig } from '../lib/config';
import { DeployIdentityStack } from '../lib/deploy-identity-stack';
import { SiteStack } from '../lib/site-stack';

const account = '123456789012';
const context = {
  domain: 'example.dev',
  hostedZoneId: 'Z123',
  githubRepo: 'Owner/repo',
  demoApis: { 'laplacian-glm': 'abc.execute-api.us-east-1.amazonaws.com' },
};

function synth() {
  const app = new cdk.App({ context });
  const cfg = loadConfig(app);
  // Build every stack first: synthesizing (Template.fromStack) freezes the app.
  const stacks: Record<string, cdk.Stack> = {};
  for (const stage of cfg.stages) {
    const certs = new CertificatesStack(app, `C-${stage.Stage}`, { env: { account, region: 'us-east-1' }, crossRegionReferences: true, cfg, stage });
    stacks[`cert-${stage.stage}`] = certs;
    stacks[`site-${stage.stage}`] = new SiteStack(app, `S-${stage.Stage}`, { env: { account, region: 'us-east-2' }, crossRegionReferences: true, cfg, stage, certificate: certs.certificate });
  }
  stacks.identity = new DeployIdentityStack(app, 'I', { env: { account, region: 'us-east-2' }, cfg });
  return Object.fromEntries(Object.entries(stacks).map(([k, s]) => [k, Template.fromStack(s)]));
}
const t = synth();

describe('config', () => {
  it('refuses to synth without a hosted zone unless synthOnly is set', () => {
    expect(() => loadConfig(new cdk.App({ context: { ...context, hostedZoneId: '' } }))).toThrow(/hostedZoneId/);
    expect(loadConfig(new cdk.App({ context: { ...context, hostedZoneId: '', synthOnly: 'true' } })).hostedZoneId).toMatch(/PLACEHOLDER/);
  });
});

describe('site stacks', () => {
  it('keeps the bucket private and encrypted', () => {
    t['site-prod'].hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
      BucketEncryption: Match.anyValue(),
    });
    t['site-prod'].hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
  });

  it('answers on the apex and www in prod, and dev.<domain> in dev', () => {
    t['site-prod'].hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: ['example.dev', 'www.example.dev'] }),
    });
    t['site-dev'].hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: ['dev.example.dev'] }),
    });
  });

  it('proxies the Laplacian demo API under /api/laplacian-glm/* without caching', () => {
    t['site-prod'].hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: [Match.objectLike({
          PathPattern: '/api/laplacian-glm/*',
          AllowedMethods: Match.arrayWith(['POST']),
          CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // Managed-CachingDisabled
        })],
      }),
    });
  });

  it('tells search engines to skip dev only', () => {
    const header = Match.objectLike({ Header: 'X-Robots-Tag' });
    t['site-dev'].hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({ CustomHeadersConfig: { Items: [header] } }),
    });
    expect(JSON.stringify(t['site-prod'].findResources('AWS::CloudFront::ResponseHeadersPolicy'))).not.toContain('X-Robots-Tag');
  });

  it('bakes each stage\'s canonical host into its request function', () => {
    const code = (tpl: Template) => JSON.stringify(tpl.findResources('AWS::CloudFront::Function'));
    expect(code(t['site-prod'])).toContain('var CANONICAL_HOST = \\"example.dev\\"');
    expect(code(t['site-dev'])).toContain('var CANONICAL_HOST = \\"dev.example.dev\\"');
  });

  it('creates A and AAAA records for every host', () => {
    t['site-prod'].resourceCountIs('AWS::Route53::RecordSet', 4);
    t['site-dev'].resourceCountIs('AWS::Route53::RecordSet', 2);
  });

  it('covers every host on the certificate', () => {
    t['cert-prod'].hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'example.dev', SubjectAlternativeNames: ['www.example.dev'],
    });
  });
});

describe('redirects', () => {
  it('301s the retired site paths to their new pages', () => {
    const cfg = loadConfig(new cdk.App({ context }));
    expect(cfg.stages[1].redirects).toEqual({ '/work': '/professional', '/projects': '/personal', '/publications': '/academic' });
  });
});

describe('deploy identity', () => {
  it('trusts only the repo\'s dev and prod environments', () => {
    const roles = t.identity.findResources('AWS::IAM::Role');
    const trust = JSON.stringify(roles);
    expect(trust).toContain('repo:Owner/repo:environment:dev');
    expect(trust).toContain('repo:Owner/repo:environment:prod');
    expect(trust).not.toContain('ref:refs/heads');
  });
});
