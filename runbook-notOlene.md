# runbook-notOlene: everything Nelson runs (non-Olene work)

What a person still has to do for the portfolio and the Ph.D. research, in order.
Steps Claude already ran are listed under **Done** with what was checked, so nothing is repeated.

## Still to do

| # | Area | What | When | Time |
|---|---|---|---|---|
| 1 | Portfolio | Update the website link on LinkedIn | Now | 2 min |
| 2 | Research | Send Dr. Yang the five open questions | Now | 5 min |
| 3 | Research | Ask for an MTSU HPC GPU allocation | Now (takes days to approve) | 5 min |
| 4 | Research | Create the Python environment and check the GPU | Week 1 | 10 min |
| 5 | Research | Download ABIDE I (preprocessed ROI time series) | Week 1 | 10–20 min |
| 6 | Research | Create the private code repository | Week 1 | 2 min |
| 7 | Research | Download ABIDE II raw scans and preprocess with DPARSF | Weeks 13–16 | hours (runs unattended) |

The research plan these steps support is `/Users/nelsontorres/Desktop/research/contrastive-fmri/PROJECT1_PLAN.md`.

Steps 2, 3 and the ABIDE terms in step 5 need you. Steps 4–6 I can run in a session when you say
"start Project 1"; the commands are here so you can follow along or run them yourself.

### 1. Update links to the site

LinkedIn → Edit intro → Website: `https://nelsontorres.dev`. The résumé PDF in `public/Resume.pdf`
can point there too. Old links (`nelsontorresjr330.github.io/...`) keep working: they forward to the
same path on nelsontorres.dev.

### 2. Send Dr. Yang the five open questions

Their answers fix choices the code depends on. Paste into an email:

1. ABIDE II: run both datasets through DPARSF, or keep the preprocessed (PCP) data for ABIDE I?
2. Main evaluation: leave-one-site-out, 10-fold cross-validation, or both?
3. Weeks 3–4 practice benchmark: CIFAR-10 (the standard SimCLR check) or a time-series dataset?
4. Target venue and deadline.
5. GPU compute: MTSU HPC allocation, or another resource?

Write the answers into section 9 of `PROJECT1_PLAN.md` when they come back.

### 3. Ask for MTSU HPC GPU time

The M4 Max is enough for development; the full experiment grid (5 seeds × 17+ sites × ablations)
needs a GPU cluster. Ask MTSU research computing (or Dr. Yang, if the lab has an allocation) for an
account with GPU access. Nothing to run yet; note the login host and partition name in the plan.

### 4. Python environment and GPU check (week 1)

Python 3.12 in a project venv (your system Python is 3.14; PyTorch and nilearn are most reliable on 3.12):

```bash
cd /Users/nelsontorres/Desktop/research/contrastive-fmri
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install torch nilearn scikit-learn pandas pyyaml matplotlib
python -c "import torch; print(torch.__version__, 'mps:', torch.backends.mps.is_available())"
```

Expected: a torch version and `mps: True` (the M4 Max GPU). Stop if `mps: False` and send me the
output.

### 5. Download ABIDE I (week 1)

The Preprocessed Connectomes Project publishes ABIDE I already cleaned, as each brain region's
signal over time. ABIDE is free but has data usage terms: register at NITRC (nitrc.org, ABIDE project)
and accept them before downloading. This downloads about 870 quality-checked participants, CC200
atlas (200 regions):

```bash
cd /Users/nelsontorres/Desktop/research/contrastive-fmri
source .venv/bin/activate
python - <<'PY'
from nilearn.datasets import fetch_abide_pcp
d = fetch_abide_pcp(data_dir="data", pipeline="cpac", band_pass_filtering=True,
                    global_signal_regression=False, derivatives=["rois_cc200"], quality_checked=True)
print(len(d.rois_cc200), "subjects;", d.rois_cc200[0].shape, "time points x ROIs")
print(d.phenotypic["SITE_ID"].value_counts().to_string())
PY
```

Expected: about `871 subjects; (T, 200)` with T roughly 70–320, then a list of about 17 sites with
their participant counts. ABIDE data is shared under a data usage agreement: it stays in `data/`
and is never committed or uploaded.

### 6. Create the private code repository (week 1)

```bash
cd /Users/nelsontorres/Desktop/research/contrastive-fmri
printf 'data/\n.venv/\n__pycache__/\n*.pt\nruns/\n' > .gitignore
git init -b main && git add .gitignore PROJECT1_PLAN.md && git commit -m "Project 1 plan"
gh repo create Nelsontorresjr330/contrastive-fmri --private --source . --push
git switch -c dev && git push -u origin dev
```

Expected: a URL for the new private repo. Work happens on `dev`, as in your other repos.

### 7. ABIDE II preprocessing (weeks 13–16)

ABIDE II has no preprocessed release, so it goes through the same DPARSF pipeline used for the ADNI
project (MATLAB R2026a, DPABI and SPM12 are already installed under
`~/Desktop/research/alzheimers-rsfmri-graph-theory/toolboxes`). I will write the download and
batch scripts when we get there; the step for you will be starting the MATLAB batch and letting it
run. About 1,100 scans; plan on an overnight run.

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
