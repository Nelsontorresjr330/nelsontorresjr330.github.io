# Future context: known risks and deferred work

## Known risks

| Date | Risk | Fix |
|---|---|---|
| 2026-11-17 | Until cutover (RUNBOOK-hosting.md, step 7), two copies of the site are live: GitHub Pages (`deploy.yml`, whose bot commits `docs/` straight to `main`) and AWS. | Step 7 deletes `deploy.yml` and leaves redirect pages in `docs/`. |
| 2026-11-17 | The `laplacian-glm` CloudFormation stack (us-east-1) is in `UPDATE_ROLLBACK_COMPLETE`: the 2026-05-20 update failed because the function has a custom name (`laplacian-glm`) and the change needed a replacement. The live API works, but the template and what's deployed have drifted. | Drop `FunctionName` from `research/cloudformation.yaml` (or rename it) and redeploy with `research/scripts/deploy_container.sh`. |
| 2026-11-17 | The Laplacian demo API is public with no throttling. Anyone can `POST /run` and run Lambda time on the account. | Set stage throttling on the HTTP API (e.g. 2 req/s, burst 5), or accept requests only from CloudFront with a secret origin header. |
| 2026-11-17 | The API's CORS list allows only `nelsontorresjr330.github.io` and localhost. On AWS the site calls it through `/api/laplacian-glm/*` (same origin), so CORS doesn't apply there. | After cutover, remove the github.io origin from `research/cloudformation.yaml`. |
| 2026-11-17 | `npm audit` lists findings in dev-only packages (Storybook toolchain). The production bundle has none (`npm audit --omit=dev`). | Re-check on each Storybook upgrade. |
| 2026-11-17 | jsdom is pinned to 29: jsdom 31's undici needs a newer Node than 22.14. | Unpin when local Node and CI move past 22.14. |

## Future jobs

| Job | Notes |
|---|---|
| Pick a design concept and rebuild the pages | Storybook (`npm run storybook`) has three: A Notebook, B Lab, C Index. All read `src/content/portfolio.js`. Keep every path in `ROUTES` (App.jsx); add redirects in `infra/cdk/lib/config.ts` for anything that moves. |
| Fill content gaps | Start dates for the Ph.D. and Olene Software; confirm the personal projects listed. |
| Project 1 demo page `/research/contrastive-asd` | See `~/Desktop/research/contrastive-fmri/PROJECT1_PLAN.md`, "Demo". Static first (precomputed embeddings and results), then a Lambda behind `/api/contrastive-asd/*` (add it to `demoApis` in `cdk.json`). |
| Project 2 and 3 demo pages | `/research/graph-contrastive`, `/research/dynamic-fc`. Same pattern. |
| Remove the GitHub Pages SPA shim | After cutover, delete `public/404.html` and the query-string decoder in `index.html`; CloudFront serves React routes directly. |
| Budget alarm | Add an AWS Budget for tag `app=portfolio` once demos with compute go live. |
| Update the Laplacian README link | `research/README.md` points at the github.io URL; switch it after cutover. |
