# Runbook: move the portfolio to its own domain on AWS

Moves the site from `nelsontorresjr330.github.io` (GitHub Pages) to a custom domain on S3 and
CloudFront, the same way the Olene apps are hosted. GitHub Pages stays live until step 7, so
nothing breaks before the new site has been checked.

| Host | Serves |
|---|---|
| `<domain>` | the site (prod), deployed when a `dev` → `main` PR merges |
| `www.<domain>` | 301 to `<domain>`, same path |
| `dev.<domain>` | the site (dev), deployed on every push to `dev`; not indexed by search engines |
| `dev.<domain>/storybook/` | Storybook (design concepts) |
| `<domain>/api/<demo>/*` | each research demo's API, proxied by CloudFront (no CORS) |
| `nelsontorresjr330.github.io/*` | after step 7: forwards to the same path on `<domain>` |

Stacks (`infra/cdk`): `Portfolio-DeployIdentity`, `Portfolio-Certificates-{Dev,Prod}` (us-east-1),
`Portfolio-Site-{Dev,Prod}` (us-east-2). Expected cost: the domain (about $17 a year for `.dev`),
$0.50 a month for the hosted zone, and cents for S3 and CloudFront.

Set this once in your shell and keep the terminal open for the steps below:

```bash
DOMAIN=nelsontorres.dev        # the domain you picked
REPO=Nelsontorresjr330/nelsontorresjr330.github.io
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
```

## 1. Register the domain (a purchase, done by hand)

Route 53 console → **Registered domains** → **Register domains** → search `$DOMAIN` → checkout.
Turn on **auto-renew** and **privacy protection**. Registering through Route 53 creates the
hosted zone automatically.

Then confirm it finished (registration takes about 5 to 15 minutes; a first-time registrant also
gets a verification email that must be clicked within 15 days):

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
aws route53domains get-domain-detail --region us-east-1 --domain-name "$DOMAIN" --query StatusList --output text
```

Expected: a line containing `clientTransferProhibited` (or similar statuses). An error saying the
domain was not found means it is still registering; wait and run it again.

## 2. Put the domain and hosted zone in `cdk.json`

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" --query 'HostedZones[0].Id' --output text | sed 's#/hostedzone/##')
echo "$ZONE_ID"
```

Expected: an ID starting with `Z` (for example `Z0123456789ABCDEFGHIJ`). Stop if it prints `None`.

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io/infra/cdk
node -e '
const fs = require("fs"); const c = JSON.parse(fs.readFileSync("cdk.json"));
c.context.domain = process.argv[1]; c.context.hostedZoneId = process.argv[2];
fs.writeFileSync("cdk.json", JSON.stringify(c, null, 2) + "\n");' "$DOMAIN" "$ZONE_ID"
grep -E '"domain"|"hostedZoneId"' cdk.json
```

Expected: both lines show your values. Commit on `dev` (don't push yet):

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
git switch dev && git add infra/cdk/cdk.json && git commit -m "Point the portfolio at $DOMAIN"
```

## 3. Create the GitHub Actions deploy role (IAM, by hand, once)

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io/infra/cdk
npm ci
npx cdk deploy Portfolio-DeployIdentity --require-approval broadening
```

CDK shows the IAM changes and asks to confirm: one role, `GitHubActions-Portfolio-Deploy`, trusted
only by this repo's `dev` and `prod` GitHub environments. Expected output ends with:

```
Portfolio-DeployIdentity.RoleArn = arn:aws:iam::<your account>:role/GitHubActions-Portfolio-Deploy
```

## 4. Create the GitHub environments and the role variable

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
for env in dev prod; do
  gh api -X PUT "repos/$REPO/environments/$env" \
    -F 'deployment_branch_policy[protected_branches]=false' \
    -F 'deployment_branch_policy[custom_branch_policies]=true' > /dev/null
done
gh api -X POST "repos/$REPO/environments/dev/deployment-branch-policies" -f name=dev --jq .name
gh api -X POST "repos/$REPO/environments/prod/deployment-branch-policies" -f name=main --jq .name
gh variable set AWS_DEPLOY_ROLE_ARN --repo "$REPO" \
  --body "arn:aws:iam::$ACCOUNT:role/GitHubActions-Portfolio-Deploy"
gh variable list --repo "$REPO"
```

Expected: `dev`, then `main`, then a list showing `AWS_DEPLOY_ROLE_ARN`. Only `dev` can deploy to
the dev environment and only `main` to prod.

## 5. Deploy dev

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
git push -u origin dev
gh run watch --repo "$REPO" $(gh run list --repo "$REPO" --workflow deploy-aws.yml --branch dev --limit 1 --json databaseId --jq '.[0].databaseId')
```

The first run takes about 10 minutes (certificate validation and a new CloudFront distribution).
Expected: every job green, and the last step prints `Smoke test passed for https://dev.<domain>`.
If **CDK deploy** fails, stop and send me the log; nothing public has changed yet.

Open `https://dev.$DOMAIN`, `https://dev.$DOMAIN/research/laplacian-glm` (run the simulation once)
and `https://dev.$DOMAIN/storybook/`.

## 6. Ship prod

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
gh pr create --repo "$REPO" --base main --head dev --title "Portfolio on $DOMAIN" --fill
```

Merge the PR on GitHub (merge commit). The deploy's gate checks that the commit came from a
merged `dev` → `main` PR. Expected: `Smoke test passed for https://<domain>`, including the
`www` redirect. GitHub Pages also rebuilds from this merge and keeps working.

## 7. Cut over GitHub Pages (only after prod looks right)

This replaces the GitHub Pages site with pages that forward every path to the new domain, and
deletes the Pages build workflow.

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
git switch dev && git pull
node scripts/make-redirect-stub.mjs "$DOMAIN"
git rm -q .github/workflows/deploy.yml
git add docs && git commit -m "Forward nelsontorresjr330.github.io to $DOMAIN"
git push
gh pr create --repo "$REPO" --base main --head dev --title "Forward github.io to $DOMAIN" --fill
```

Merge it. A minute later, `https://nelsontorresjr330.github.io/research/laplacian-glm` should land
on `https://<domain>/research/laplacian-glm`.

## Rollback

- **Before step 7:** nothing to roll back; GitHub Pages is still the public site.
- **After step 7:** revert the cutover PR (`gh pr create` from a revert commit on `dev`), which
  restores the Pages workflow; the next merge to `main` rebuilds `docs/`.
- **A bad prod deploy:** revert the change on `dev` and merge again. The S3 bucket is versioned in
  prod, so individual files can also be restored from the console.
