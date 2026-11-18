# Nelson Torres: portfolio and research demos

Personal site with academic, professional and personal work, plus live demos of my Ph.D.
research (the Laplacian-regularized GLM simulation today; the contrastive-learning projects next).

React 19, Vite, Tailwind 4. Hosted on S3 and CloudFront with CDK (`infra/cdk`), the
same way as the Olene apps. Until cutover it is also published to GitHub Pages
(`nelsontorresjr330.github.io`).

## Run it

```bash
npm install
npm run dev               # http://localhost:3000
npm test                  # page, content and redirect tests (Vitest)
```

The Laplacian demo calls the API in `REACT_APP_GLM_API_URL` (`.env`). On AWS the build sets it to
`/api/laplacian-glm`, which CloudFront forwards to the demo's API.

Infra:

```bash
cd infra/cdk && npm install
npm test                                  # CloudFront function and stack tests
npx cdk synth -c synthOnly=true -q        # synth without a hosted zone
```

## How it ships

| Branch | Deploys to | Workflow |
|---|---|---|
| `dev` | `dev.nelsontorres.dev` | `deploy-aws.yml` |
| `main` (merged `dev` → `main` PR only) | `nelsontorres.dev` | `deploy-aws.yml` |

CI (`ci.yml`) runs every test, both builds and a CDK synth on each PR and before each deploy.

## Layout

| Path | Holds |
|---|---|
| `src/content/site.js` | all site content: stack map, roles, expertise, degrees, Olene apps |
| `src/content/laplacian.js` | the Laplacian demo's saved run and K sweep |
| `src/content/careerClock.js` | the live time-on-the-job clock (since Oct 2022) |
| `src/pages/` | Landing (stack map), Professional, Academic, Personal, Laplacian demo |
| `infra/cdk/` | stacks, CloudFront functions, and their tests |
| `research/` | the Laplacian GLM paper's code and demo backend |
| `scripts/` | the GitHub Pages redirect generator (cutover) |

Docs: [runbook-notOlene.md](runbook-notOlene.md) (everything a person runs, in order: domain, AWS, cutover, demo API, Project 1 setup) ·
[futureContext.md](futureContext.md) (risks and future jobs).
