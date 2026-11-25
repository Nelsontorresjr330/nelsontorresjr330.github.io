# runbook-notOlene: everything Nelson runs (non-Olene work)

What a person still has to do for the portfolio and the Ph.D. research, in order.
Steps Claude already ran are listed under **Done** with what was checked, so nothing is repeated.

## Still to do

| # | Area | What | When | Time |
|---|---|---|---|---|
| 8 | Research | Lessons: weeks 1–2 (PyTorch), then weeks 3–4 (SimCLR on HAR) | Now (In Progress) | 4–6 hours each |
| 3 | Research | MTSU HPC (Babbage) access: requested, waiting on MTSU | Requested | Follow-up only |
| 7 | Research | Download ABIDE II raw scans and preprocess with DPARSF | Weeks 13–16 | 1–2 days on the laptop (runs unattended) |

Steps 1, 2, 4, 5 and 6 are done (see **Done**); the numbers are kept so references to them stay valid.

**Where Project 1 stands (2026-11-25).** Decisions are made, the code repo and environment are set
up, and ABIDE I (871 subjects, both pipelines) is downloaded. The first baseline is done: 0.673
balanced accuracy on unseen sites, matching the literature, which is the number to beat. The weeks
3–4 SimCLR lesson is built and waiting. You are in weeks 1–2, learning PyTorch. Babbage isn't
needed before about week 9.
The status table at the top of `PROJECT1_PLAN.md` is the one place this is kept current.

The research plan these steps support is `/Users/nelsontorres/Desktop/research/contrastive-fmri/PROJECT1_PLAN.md`.

Research code: <https://github.com/Nelsontorresjr330/contrastive-fmri> (private; work on `dev`).
Weekly lessons: `lessons/README.md` in that repo.

Your Desktop syncs to iCloud. The project's Python environment and datasets live in folders ending
in `.nosync` (which iCloud skips), reached through the links `.venv` and `data`. Keep it that way:
ABIDE data must not be uploaded, and iCloud also breaks the environment (it hides files Python
needs).

### 8. Lessons (In Progress)

**Weeks 1–2: PyTorch foundations.**

The full guide is `lessons/README.md` in the research repo: read PyTorch's "Learn the Basics"
tutorial (about 3 hours), run the week 1 script, read the three short files it uses, and try the
four small experiments.

```bash
cd /Users/nelsontorres/Desktop/research/contrastive-fmri
source .venv/bin/activate
python lessons/week01_pytorch_basics.py
```

Expected: five short parts, then eight epochs whose validation balanced accuracy climbs from about
0.33 to above 0.9, in a few seconds. Stop and send me the output if it errors, especially
`No module named 'cfmri'` (the iCloud problem below). Done when you can explain each line of
`train_one_epoch` in `src/cfmri/train.py`.

**Weeks 3–4: SimCLR on UCI HAR**, after weeks 1–2. The guide is in the same `lessons/README.md`.

```bash
cd /Users/nelsontorres/Desktop/research/contrastive-fmri
source .venv/bin/activate
python lessons/week03_simclr_har.py
```

Expected, in about 30 seconds: a final table with an untrained encoder at about 0.91, SimCLR at
about 0.93–0.94 and fully supervised at about 0.95. Stop and send me the output if SimCLR is not
above the untrained encoder.

### 3. MTSU HPC (Babbage) access (Requested)

You requested it; MTSU hasn't granted it yet. Nothing to run. If there's no reply by mid-December,
follow up with MTSU research computing, or ask Dr. Yang whether the lab has an allocation you can
join. Ask for an account with GPU access. The laptop (M4 Max) covers
weeks 1–8; the full experiment grid (5 seeds × 17 sites × ablations) needs the cluster from about
week 9. When it is approved, send me the login host, the GPU partition name and any storage
quota, and I will add the cluster steps here and to section 9 of the plan.

### 7. ABIDE II preprocessing (weeks 13–16)

ABIDE II has no preprocessed release, so it goes through the same DPARSF pipeline used for the ADNI
project, with settings matched to PCP's DPARSF output from step 5 (MATLAB R2026a, DPABI and SPM12 are already installed under
`/Users/nelsontorres/Desktop/research/alzheimers-rsfmri-graph-theory/toolboxes`). I will write the download and
batch scripts when we get there; the step for you will be starting the MATLAB batch and letting it
run. About 1,100 scans at roughly 10–20 minutes each: 1–2 days with parallel jobs on the laptop,
or hours on MTSU's cluster if it has MATLAB.

## Done

| Step | What was done | How it was checked |
|---|---|---|
| Runbook 1 | Website link on LinkedIn set to `https://nelsontorres.dev` | Nelson |
| Runbook 2 | Dr. Yang's five questions answered and recorded in section 9 of `PROJECT1_PLAN.md`: C-PAC main, DPARSF check and ABIDE II external test; LOSO primary; UCI HAR benchmark; no deadline; MTSU HPC | Nelson; plan updated |
| Runbook 4 | Python 3.12 venv in `contrastive-fmri/.venv`: torch 2.15, nilearn 0.14.1, scikit-learn 1.9.1 | `mps: True` (M4 Max GPU) |
| Runbook 5 | NITRC account (Nelson; ABIDE's only requirement). ABIDE I CC200 downloaded by Claude for C-PAC and DPARSF into `data.nosync` (950 MB, not synced or committed). The NITRC zip in `~/Downloads/scripts` is the unrelated 2010 1000 Functional Connectomes preprocessing scripts and can be deleted | Both pipelines: 871 subjects (403 ASD, 468 TD), 20 site IDs (17 institutions), 77–316 time points × 200 ROIs |
| Research 2026-11-25 | First ABIDE I baseline (FC + logistic regression / SVM / random forest) and the weeks 3–4 SimCLR lesson, built by Claude | 41 tests in CI; 0.673 balanced accuracy under LOSO; HAR SimCLR 0.936 vs 0.915 untrained. Plan section 10 |
| Runbook 6 | Private repo `Nelsontorresjr330/contrastive-fmri` (`main` and `dev`), CI on every push and PR | CI green, 11 tests; week 1 lesson trains to 0.98 balanced accuracy |
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
