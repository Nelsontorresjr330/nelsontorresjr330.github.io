# runbook-notOlene: everything Nelson runs (non-Olene work)

What a person still has to do for the portfolio and the Ph.D. research, in order.
Steps Claude already ran are listed under **Done** with what was checked, so nothing is repeated.

## Still to do

| # | Area | What | When | Time |
|---|---|---|---|---|
| 3 | Research | Request an MTSU HPC allocation with GPU access | In Progress (Nelson) | 5 min |
| 4 | Research | Create the Python environment and check the GPU | Week 1 | 10 min |
| 5 | Research | Accept the ABIDE terms, then download ABIDE I (two pipelines) | Week 1 | 20–40 min |
| 6 | Research | Create the private code repository | Week 1 | 2 min |
| 7 | Research | Download ABIDE II raw scans and preprocess with DPARSF | Weeks 13–16 | hours (runs unattended) |

Steps 1 and 2 are done (see **Done**); the numbers are kept so references to them stay valid.

The research plan these steps support is `/Users/nelsontorres/Desktop/research/contrastive-fmri/PROJECT1_PLAN.md`.

Step 3 and the ABIDE terms in step 5 need you. Steps 4–6 I can run in a session when you say
"start Project 1"; the commands are here so you can follow along or run them yourself.

### 3. MTSU HPC allocation (In Progress)

You are requesting it from MTSU. Ask for an account with GPU access. The laptop (M4 Max) covers
weeks 1–8; the full experiment grid (5 seeds × 17 sites × ablations) needs the cluster from about
week 9. When it is approved, send me the login host, the GPU partition name and any storage
quota, and I will add the cluster steps here and to section 9 of the plan.

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
d2 = fetch_abide_pcp(data_dir="data", pipeline="dparsf", band_pass_filtering=True,
                     global_signal_regression=False, derivatives=["rois_cc200"], quality_checked=True)
print("dparsf:", len(d2.rois_cc200), "subjects")
PY
```

Expected: about `871 subjects; (T, 200)` with T roughly 70–320, a list of about 17 sites with their
participant counts, then `dparsf:` with a similar subject count (the same people through a second
pipeline, used to test whether results survive a preprocessing change). Stop if either count is 0. ABIDE data is shared under a data usage agreement: it stays in `data/`
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
project, with settings matched to PCP's DPARSF output from step 5 (MATLAB R2026a, DPABI and SPM12 are already installed under
`~/Desktop/research/alzheimers-rsfmri-graph-theory/toolboxes`). I will write the download and
batch scripts when we get there; the step for you will be starting the MATLAB batch and letting it
run. About 1,100 scans; plan on an overnight run.

## Done (2026-11-18)

| Step | What was done | How it was checked |
|---|---|---|
| Runbook 1 | Website link on LinkedIn set to `https://nelsontorres.dev` | Nelson |
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
