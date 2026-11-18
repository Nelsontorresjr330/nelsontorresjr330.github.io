# Master runbook: everything Nelson runs

One ordered list of the commands only a person can run for the portfolio, the research demos and
Project 1. Do the parts in order; each block starts with `cd`, says what to expect, and where to
stop. Parts 1–8 move the site to **nelsontorres.dev** on AWS. GitHub Pages stays live until
part 8, so nothing public changes before the new site has been checked.

| Part | What | Needs |
|---|---|---|
| 1 | Push the `dev` branch and check CI | GitHub |
| 2 | Register nelsontorres.dev | a purchase, about $17/yr |
| 3 | Put the hosted zone in `cdk.json` | AWS read |
| 4 | Create the GitHub deploy role | IAM change |
| 5 | Create GitHub environments and the role variable | GitHub admin |
| 6 | Deploy dev and check it | — |
| 7 | Ship prod | merge a PR |
| 8 | Forward nelsontorresjr330.github.io to the new domain | merge a PR |
| 9 | Rate-limit the Laplacian demo API | AWS change |
| 10 | Set up Project 1 (PyTorch, ABIDE I) | ~1 GB download |

What the site looks like when done:

| Host | Serves |
|---|---|
| `nelsontorres.dev` | the site (prod), deployed when a `dev` → `main` PR merges |
| `www.nelsontorres.dev` | 301 to `nelsontorres.dev`, same path |
| `dev.nelsontorres.dev` | the site (dev), deployed on every push to `dev`; not indexed |
| `dev.nelsontorres.dev/storybook/` | Storybook |
| `nelsontorres.dev/api/<demo>/*` | each research demo's API, proxied by CloudFront (no CORS) |
| `nelsontorresjr330.github.io/*` | after part 8: forwards to the same path on nelsontorres.dev |

Set these once and keep the terminal open for parts 1–9:

```bash
DOMAIN=nelsontorres.dev
REPO=Nelsontorresjr330/nelsontorresjr330.github.io
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "$DOMAIN $REPO $ACCOUNT"
```

Expected: the domain, the repo and a 12-digit account number. Stop if the account is empty
(run `aws sso login` or fix your AWS profile first).

## 1. Push `dev` and check CI

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
git status --short
git log --oneline origin/main..dev
```

Expected: `git status` shows only your own two research edits
(`research/scripts/core_glm.py`, `research/scripts/deploy_container.sh`), which are not part of
this work. The log lists the portfolio commits. Then:

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
git push -u origin dev
sleep 15
gh run watch --repo "$REPO" $(gh run list --repo "$REPO" --workflow deploy-aws.yml --branch dev --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: the `checks / web` and `checks / infra` jobs pass, and `deploy` is **skipped** (it waits
for part 5). Stop if a check fails and send me the log.

## 2. Register nelsontorres.dev (a purchase, by hand)

Route 53 console → **Registered domains** → **Register domains** → `nelsontorres.dev` → checkout,
with **auto-renew** and **privacy protection** on. Route 53 creates the hosted zone for you. A
first-time registrant gets a verification email that must be clicked within 15 days.

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
aws route53domains get-domain-detail --region us-east-1 --domain-name "$DOMAIN" --query StatusList --output text
```

Expected (after 5–15 minutes): statuses such as `clientTransferProhibited`. "Domain not found"
means it is still registering; wait and rerun.

## 3. Put the hosted zone in `cdk.json`

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" --query 'HostedZones[0].Id' --output text | sed 's#/hostedzone/##')
echo "$ZONE_ID"
```

Expected: an ID starting with `Z`. Stop if it prints `None`.

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io/infra/cdk
node -e '
const fs = require("fs"); const c = JSON.parse(fs.readFileSync("cdk.json"));
c.context.domain = process.argv[1]; c.context.hostedZoneId = process.argv[2];
fs.writeFileSync("cdk.json", JSON.stringify(c, null, 2) + "\n");' "$DOMAIN" "$ZONE_ID"
grep -E '"domain"|"hostedZoneId"' cdk.json
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
git add infra/cdk/cdk.json && git commit -m "Point the portfolio at $DOMAIN"
```

Expected: both lines show your values, then a one-file commit. Don't push yet.

## 4. Create the GitHub Actions deploy role (IAM, once)

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io/infra/cdk
npm ci
npx cdk deploy Portfolio-DeployIdentity --require-approval broadening
```

CDK shows one new role, `GitHubActions-Portfolio-Deploy`, trusted only by this repo's `dev` and
`prod` GitHub environments, and asks to confirm. Expected last line:
`Portfolio-DeployIdentity.RoleArn = arn:aws:iam::<account>:role/GitHubActions-Portfolio-Deploy`.

## 5. GitHub environments and the role variable

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
for env in dev prod; do
  gh api -X PUT "repos/$REPO/environments/$env" \
    -F 'deployment_branch_policy[protected_branches]=false' \
    -F 'deployment_branch_policy[custom_branch_policies]=true' > /dev/null
done
gh api -X POST "repos/$REPO/environments/dev/deployment-branch-policies" -f name=dev --jq .name
gh api -X POST "repos/$REPO/environments/prod/deployment-branch-policies" -f name=main --jq .name
gh variable set AWS_DEPLOY_ROLE_ARN --repo "$REPO" --body "arn:aws:iam::$ACCOUNT:role/GitHubActions-Portfolio-Deploy"
gh variable list --repo "$REPO"
```

Expected: `dev`, `main`, then a list showing `AWS_DEPLOY_ROLE_ARN`.

## 6. Deploy dev

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
git push
sleep 15
gh run watch --repo "$REPO" $(gh run list --repo "$REPO" --workflow deploy-aws.yml --branch dev --limit 1 --json databaseId --jq '.[0].databaseId')
```

The first run takes about 10 minutes (certificate and a new CloudFront distribution). Expected:
all green, ending `Smoke test passed for https://dev.nelsontorres.dev`. If **CDK deploy** fails,
stop and send me the log; nothing public has changed.

Then open `https://dev.nelsontorres.dev`, run the simulation once at
`https://dev.nelsontorres.dev/research/laplacian-glm`, and look at
`https://dev.nelsontorres.dev/storybook/`.

## 7. Ship prod

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
gh pr create --repo "$REPO" --base main --head dev --title "Portfolio on nelsontorres.dev" --fill
```

Merge it on GitHub (merge commit). Expected: `Smoke test passed for https://nelsontorres.dev`,
including the `www` redirect. GitHub Pages also rebuilds from this merge and keeps working.

## 8. Forward github.io to the new domain (only after prod looks right)

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
git switch dev && git pull
node scripts/make-redirect-stub.mjs "$DOMAIN"
git rm -q .github/workflows/deploy.yml
git add docs && git commit -m "Forward nelsontorresjr330.github.io to $DOMAIN"
git push
gh pr create --repo "$REPO" --base main --head dev --title "Forward github.io to $DOMAIN" --fill
```

Merge it. A minute later `https://nelsontorresjr330.github.io/research/laplacian-glm` should land
on `https://nelsontorres.dev/research/laplacian-glm`. Update the website link on LinkedIn to
`https://nelsontorres.dev`.

## 9. Rate-limit the Laplacian demo API

The demo's API is public with no limit, so anyone can start Lambda runs on the account. The page
polls every 3 seconds, so 5 requests a second (bursts of 10) never bothers a real visitor.

```bash
cd ~/Desktop/"Git Repos"/nelsontorresjr330.github.io
aws apigatewayv2 update-stage --region us-east-1 --api-id osxigbaria --stage-name '$default' \
  --default-route-settings '{"ThrottlingRateLimit":5,"ThrottlingBurstLimit":10,"DetailedMetricsEnabled":false}' \
  --query DefaultRouteSettings --output json
```

Expected:

```json
{ "DetailedMetricsEnabled": false, "ThrottlingBurstLimit": 10, "ThrottlingRateLimit": 5.0 }
```

Then run the simulation once on the live site to confirm it still works. To undo: rerun with
`'{"DetailedMetricsEnabled":false}'`. (The `laplacian-glm` CloudFormation stack doesn't know about
this setting yet; see futureContext.md.)

## 10. Set up Project 1 (PyTorch and ABIDE I)

Python 3.12 in a project venv (PyTorch support for your system Python 3.14 can lag):

```bash
cd ~/Desktop/research/contrastive-fmri
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install torch nilearn scikit-learn pandas pyyaml
python -c "import torch; print(torch.__version__, 'mps:', torch.backends.mps.is_available())"
```

Expected: a torch version and `mps: True` (the M4 Max GPU). Stop if `mps: False`.

Download ABIDE I preprocessed ROI time series (CC200 atlas, C-PAC, band-pass, no global signal
regression, quality-checked subjects only):

```bash
cd ~/Desktop/research/contrastive-fmri
source .venv/bin/activate
python - <<'PY'
from nilearn.datasets import fetch_abide_pcp
d = fetch_abide_pcp(data_dir="data", pipeline="cpac", band_pass_filtering=True,
                    global_signal_regression=False, derivatives=["rois_cc200"], quality_checked=True)
print(len(d.rois_cc200), "subjects;", d.rois_cc200[0].shape, "time points x ROIs")
PY
printf 'data/\n.venv/\n' > .gitignore
```

Expected: about `871 subjects; (T, 200)` with T between roughly 70 and 320. The first run downloads
for several minutes. Data stays in `data/` and is never committed (ABIDE data usage agreement).

## Rollback

| If | Do |
|---|---|
| Something fails before part 8 | Nothing to undo; GitHub Pages is still the public site |
| The cutover (part 8) misbehaves | Revert that PR's commit on `dev` and merge again; it restores the Pages workflow |
| A prod deploy is bad | Revert the change on `dev` and merge again; prod's S3 bucket is versioned |
| Throttling (part 9) blocks real use | Rerun part 9's command with `'{"DetailedMetricsEnabled":false}'` |
