import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { PortfolioConfig, StageConfig } from './config';

export interface CertificatesStackProps extends cdk.StackProps {
  cfg: PortfolioConfig;
  stage: StageConfig;
}

/** CloudFront only accepts certificates from us-east-1, so this stack lives there. */
export class CertificatesStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificatesStackProps) {
    super(scope, id, props);
    const { cfg, stage } = props;
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: cfg.hostedZoneId,
      zoneName: cfg.domain,
    });
    const [primary, ...alternates] = stage.hosts;
    this.certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: primary,
      subjectAlternativeNames: alternates.length ? alternates : undefined,
      validation: acm.CertificateValidation.fromDns(zone),
    });
    new cdk.CfnOutput(this, 'CertificateArn', { value: this.certificate.certificateArn });
  }
}
