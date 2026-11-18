# runbook-notOlene: everything Nelson runs (non-Olene work)

What a person still has to do for the portfolio and the Ph.D. research, in order.
Steps Claude already ran are listed under **Done** with what was checked, so nothing is repeated.

## Still to do

| # | Area | What | When | Time |
|---|---|---|---|---|
| 3 | Research | Request an MTSU HPC allocation with GPU access | In Progress (Nelson) | 5 min |
| 5 | Research | Register on NITRC and accept the ABIDE terms; tell Claude, who runs the download | Now | 10 min |
| 7 | Research | Download ABIDE II raw scans and preprocess with DPARSF | Weeks 13–16 | hours (runs unattended) |

Steps 1, 2, 4 and 6 are done (see **Done**); the numbers are kept so references to them stay valid.

The research plan these steps support is `/Users/nelsontorres/Desktop/research/contrastive-fmri/PROJECT1_PLAN.md`.

Research code: <https://github.com/Nelsontorresjr330/contrastive-fmri> (private; work on `dev`).
Weekly lessons: `lessons/README.md` in that repo.

### 3. MTSU HPC allocation (In Progress)

You are requesting it from MTSU. Ask for an account with GPU access. The laptop (M4 Max) covers
weeks 1–8; the full experiment grid (5 seeds × 17 sites × ablations) needs the cluster from about
week 9. When it is approved, send me the login host, the GPU partition name and any storage
quota, and I will add the cluster steps here and to section 9 of the plan.

### 5. ABIDE terms, then the ABIDE I download

ABIDE is free for non-commercial research, but each user must register and accept its terms.

1. Create a NITRC account at <https://www.nitrc.org/account/register.php>.
2. Request access to the ABIDE project ("1000 Functional Connectomes / INDI", ABIDE) and accept
   the data usage terms.
3. Tell me it's done. I run the download (`python scripts/fetch_abide.py`, 20–40 min). If you
   would rather run it yourself:

```bash
cd /Users/nelsontorres/Desktop/research/contrastive-fmri
source .venv/bin/activate
python scripts/fetch_abide.py
```

Expected: a `cpac:` line with about 871 subjects (about 400 ASD, 470 TD) across about 17 sites
with a per-site list, then a `dparsf:` line with a similar count. Stop if either count is 0. Data
stays in `data/`, which git ignores and which is never uploaded.

### 7. ABIDE II preprocessing (weeks 13–16)

ABIDE II has no preprocessed release, so it goes through the same DPARSF pipeline used for the ADNI
project, with settings matched to PCP's DPARSF output from step 5 (MATLAB R2026a, DPABI and SPM12 are already installed under
`~/Desktop/research/alzheimers-rsfmri-graph-theory/toolboxes`). I will write the download and
batch scripts when we get there; the step for you will be starting the MATLAB batch and letting it
run. About 1,100 scans; plan on an overnight run.

## Done (2026-11-18)

| Step | What was done | How it was checked |
|---|---|---|
| Runbook 1 | Website link on LinkedIn set to `https://nelsontorres.dev` | Nelson |
| Runbook 4 | Python 3.12 venv in `contrastive-fmri/.venv`: torch 2.15, nilearn 0.14.1, scikit-learn 1.9.1 | `mps: True` (M4 Max GPU) |
| Runbook 6 | Private repo `Nelsontorresjr330/contrastive-fmri` (`main` and `dev`), CI on every push and PR | CI green, 11 tests; week 1 lesson trains to 0.98 balanced accuracy |
| Runbook 2 | Dr. Yang's five questions answered and recorded in section 9 of `PROJECT1_PLAN.md`: C-PAC main, DPARSF check and ABIDE II external test; LOSO primary; UCI HAR benchmark; no deadline; MTSU HPC | Nelson; plan updated |
| Domain | `nelsontorres.dev` registered in Route 53 until 2027-11-18, auto-renew and privacy protection on, same personal contact as nelsonandgrace.com. Hosted zone `Z029417718HFE5O4F6CLQ` | Registration `SUCCESSFUL`; status `ACTIVE`; contact verification `DONE` (no email to answer) |
| Config | `infra/cdk/cdk.json` points at the domain and zone | `cdk synth` |
| Deploy role | `Portfolio-DeployIdentity` stack: role `GitHubActions-Portfolio-Deploy`, trusted only by this repo's `dev` and `prod` environments | CloudFormation `CREATE_COMPLETE` |
| GitHub | Environments `dev` (branch `dev` only) and `prod` (branch `main` only); repo variable `AWS_DEPLOY_ROLE_ARN` | `gh variable list` |
| Site stacks | `Portfolio-Certificates-{Dev,Prod}`, `Portfolio-Site-{Dev,Prod}`: certificates, S3, CloudFront, DNS | CloudFormation status; smoke tests below |
| Demo API limit | Laplacian API stage throttled to 5 req/s, bursts of 10 | `DefaultRouteSettings` on the stage |
| Dev deploy | Push to `dev` → `deploy-aws.yml` → `https://dev.nelsontorres.dev` | Workflow smoke test; a real demo run through `/api/laplacian-glm` returned +21.0% |
| Prod deploy | PR #1 (`dev` → `main`) merged → `https://nelsontorres.dev` | Workflow smoke test; curl of every page, `www` and old-path redirects, demo API |
| GitHub Pages | `nelsontorresjr330.github.io` forwards every path (query and hash kept) to nelsontorres.dev; Pages build workflow removed | Browser load of three old links (PR #2) |

## How it ships from now on

| Branch | Goes to |
|---|---|
| `dev` | `https://dev.nelsontorres.dev` (not indexed by search engines) |
| `main`, through a merged `dev` → `main` PR only | `https://nelsontorres.dev` (`www.` redirects to it) |

## Rollback

| If | Do |
|---|---|
| A prod deploy is bad | Revert the change on `dev` and merge again; prod's S3 bucket is versioned, so single files can also be restored in the console |
| The demo API throttling blocks real use | `aws apigatewayv2 update-stage --region us-east-1 --api-id osxigbaria --stage-name '$default' --default-route-settings '{"DetailedMetricsEnabled":false}'` |
| The github.io forwarding must be undone | Revert the "Forward nelsontorresjr330.github.io" commit on `dev` and merge; it restores the Pages workflow |
