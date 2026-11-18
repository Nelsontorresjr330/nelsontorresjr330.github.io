# runbook-notOlene: everything Nelson runs (non-Olene work)

What a person still has to do for the portfolio, the research demos and Ph.D. work, in order.
Steps Claude already ran are listed under **Done** with what was checked, so nothing is repeated.

## Still to do

| # | What | Time |
|---|---|---|
| 1 | Update the website link on LinkedIn and anywhere else it appears | 2 min |
| 2 | Set up Project 1 (PyTorch, ABIDE I) when the research work starts | 15 min |

### 1. Update links to the site

LinkedIn → Edit intro → Website: `https://nelsontorres.dev`. The résumé PDF in `public/Resume.pdf`
can point there too. Old links (`nelsontorresjr330.github.io/...`) keep working: they forward to the
same path on nelsontorres.dev.

### 2. Project 1 setup (PyTorch and ABIDE I)

Python 3.12 in a project venv (PyTorch support for your system Python 3.14 can lag):

```bash
cd ~/Desktop/research/contrastive-fmri
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install torch nilearn scikit-learn pandas pyyaml
python -c "import torch; print(torch.__version__, 'mps:', torch.backends.mps.is_available())"
```

Expected: a torch version and `mps: True` (the M4 Max GPU). Stop if `mps: False`.

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

Expected: about `871 subjects; (T, 200)`, T roughly 70–320. Data stays in `data/` and is never
committed (ABIDE data usage agreement).

## Done (2026-11-18)

| Step | What was done | How it was checked |
|---|---|---|
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
