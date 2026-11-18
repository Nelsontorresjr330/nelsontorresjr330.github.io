# Future context: known risks and deferred work

## Known risks

| Date | Risk | Fix |
|---|---|---|
| 2026-11-17 | Until cutover (RUNBOOK.md, part 8), two copies of the site are live: GitHub Pages (`deploy.yml`, whose bot commits `docs/` straight to `main`) and AWS. | Part 8 deletes `deploy.yml` and leaves redirect pages in `docs/`. |
| 2026-11-17 | The `laplacian-glm` CloudFormation stack (us-east-1) is in `UPDATE_ROLLBACK_COMPLETE`: the 2026-05-20 update failed because the function has a custom name (`laplacian-glm`) and the change needed a replacement. The live API works, but the template and what's deployed have drifted. | Drop `FunctionName` from `research/cloudformation.yaml` (or rename it) and redeploy with `research/scripts/deploy_container.sh`. |
| 2026-11-17 | The Laplacian demo API is public with no throttling. Anyone can `POST /run` and run Lambda time on the account. | RUNBOOK.md part 9 sets 5 req/s, burst 10 on the stage directly. Then add the same `DefaultRouteSettings` to `research/cloudformation.yaml` so a stack update doesn't undo it. |
| 2026-11-18 | The Laplacian demo's `POST /run` returned API Gateway's 500 once on a cold call (2026-11-18 04:05 UTC) and worked on retry: the container image's cold start can fail the first request after idle. Visitors see an error on first click. | Add provisioned concurrency of 1, or have the page retry `/run` once on a 5xx; check the init duration in CloudWatch. |
| 2026-11-17 | The API's CORS list allows only `nelsontorresjr330.github.io` and localhost. On AWS the site calls it through `/api/laplacian-glm/*` (same origin), so CORS doesn't apply there. | After cutover, remove the github.io origin from `research/cloudformation.yaml`. |
| 2026-11-17 | `npm audit` lists findings in dev-only packages (Storybook toolchain). The production bundle has none (`npm audit --omit=dev`). | Re-check on each Storybook upgrade. |
| 2026-11-17 | jsdom is pinned to 29: jsdom 31's undici needs a newer Node than 22.14. | Unpin when local Node and CI move past 22.14. |

## Future jobs

| Job | Notes |
|---|---|
| Pick a design concept and rebuild the pages | Concepts and experience-page mockups are on the "Portfolio Overhaul Concepts" canvas (claude.ai artifact): round 1 A–C, round 2 D–H, plus Academic / Professional / Personal pages. Latest canvas (work account): Landing F2 / I / J, experience pages, and the Laplacian demo redesign. All content comes from `src/content/portfolio.js`; the live clock from `src/content/careerClock.js`. Keep every path in `ROUTES` (App.jsx); add redirects in `infra/cdk/lib/config.ts` for anything that moves. |
| Fill content gaps | Archera: start month (Jan 2026 is inferred from LinkedIn), exact title (LinkedIn says Senior), and a line on the work. Exact career start day (clock uses 2022-10-01). Olene Software start date. |
| Project 1 demo page `/research/contrastive-asd` | See `~/Desktop/research/contrastive-fmri/PROJECT1_PLAN.md`, "Demo". Static first (precomputed embeddings and results), then a Lambda behind `/api/contrastive-asd/*` (add it to `demoApis` in `cdk.json`). |
| Project 2 and 3 demo pages | `/research/graph-contrastive`, `/research/dynamic-fc`. Same pattern. |
| Remove the GitHub Pages SPA shim | After cutover, delete `public/404.html` and the query-string decoder in `index.html`; CloudFront serves React routes directly. |
| Budget alarm | Add an AWS Budget for tag `app=portfolio` once demos with compute go live. |
| Update the Laplacian README link | `research/README.md` points at the github.io URL; switch it after cutover. |
