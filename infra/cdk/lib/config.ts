import { App } from 'aws-cdk-lib';

export const REGION = 'us-east-2';
export const APP_TAGS = { app: 'portfolio', owner: 'nelson' };

export interface StageConfig {
  /** 'dev' | 'prod' */
  stage: 'dev' | 'prod';
  /** 'Dev' | 'Prod', used in stack names */
  Stage: 'Dev' | 'Prod';
  /** The host the site answers on; every other alias 301s here. */
  canonicalHost: string;
  /** Every host on the certificate and the distribution. */
  hosts: string[];
  /** S3 bucket for the built site. */
  bucketName: (account: string) => string;
  /** Pages moved since they were first shared: old path -> new path (301). */
  redirects: Record<string, string>;
  /** Ask search engines not to index this stage. */
  noindex: boolean;
}

export interface PortfolioConfig {
  domain: string;
  hostedZoneId: string;
  githubRepo: string;
  /** Research demo APIs served under /api/<name>/*, as host names. */
  demoApis: Record<string, string>;
  stages: StageConfig[];
}

// Pages that moved: old path -> new path. Keep entries forever; links to them are out there.
const REDIRECTS: Record<string, string> = {};

export function loadConfig(app: App): PortfolioConfig {
  const domain = String(app.node.tryGetContext('domain') ?? '').trim();
  let hostedZoneId = String(app.node.tryGetContext('hostedZoneId') ?? '').trim();
  const githubRepo = String(app.node.tryGetContext('githubRepo') ?? '').trim();
  const demoApis = (app.node.tryGetContext('demoApis') ?? {}) as Record<string, string>;

  if (!domain) throw new Error('Set the "domain" context value in cdk.json.');
  if (!hostedZoneId) {
    // CI synthesizes on every PR, before the domain may be registered. Real deploys never
    // pass synthOnly, so a missing zone can't slip into a deploy.
    if (app.node.tryGetContext('synthOnly') !== 'true') {
      throw new Error('Set "hostedZoneId" in cdk.json (RUNBOOK-hosting.md, step 2).');
    }
    hostedZoneId = 'Z00000000PLACEHOLDER';
  }
  for (const name of Object.keys(demoApis)) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Demo API name "${name}" must be lowercase letters, digits and dashes.`);
  }

  return {
    domain,
    hostedZoneId,
    githubRepo,
    demoApis,
    stages: [
      {
        stage: 'dev',
        Stage: 'Dev',
        canonicalHost: `dev.${domain}`,
        hosts: [`dev.${domain}`],
        bucketName: (account) => `portfolio-site-dev-${account}`,
        redirects: REDIRECTS,
        noindex: true,
      },
      {
        stage: 'prod',
        Stage: 'Prod',
        canonicalHost: domain,
        hosts: [domain, `www.${domain}`],
        bucketName: (account) => `portfolio-site-prod-${account}`,
        redirects: REDIRECTS,
        noindex: false,
      },
    ],
  };
}
