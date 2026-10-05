# Public Recruiter Demo

URL: [Graphify AI](https://graphify-khanh-demo.vercel.app/demo).

Vercel project: `graphify-khanh-demo`, scope `khanhgiauten`, Git root directory `frontend`, Node.js `24.x`.

## Scope

Three synthetic fixtures, six schema variants, actual Python-generated profiles/quality/graph outputs, browser graph filters, keyboard-selectable nodes, data-fitted framing, and JSON export. No private files, uploads, database, credentials, persistent accounts, external LLM calls, or claimed live training.

Regenerate snapshots from the repository root:

```powershell
.\.venv\Scripts\python.exe scripts/export_public_demo.py
```

Commit `frontend/src/data/public-demo.json` together with any analysis-service changes. The export is deterministic for unchanged fixtures and services. Generated contracts are validated by their original Pydantic models and dangling edges are rejected.

Vercel `frontend/vercel.json` sets `NEXT_PUBLIC_PUBLIC_DEMO=true` in the build command, not just runtime. This makes the public header and redirect rules consistent. Without this environment setting, the complete local application routes behave as before.

Source pushes use the configured Git integration. Do not add tokens or `.vercel` state to Git. Full backend deployment remains a separate Render/database/storage task.

JSON export uses the same-origin `/api/demo-export` attachment endpoint with dataset/schema IDs restricted to the public snapshot. This avoids immediately revoked blob URLs and supports native browser downloads. Unknown IDs return 404.

## Verification

- Public `/demo` returns without authentication, root redirects to `/demo`.
- Production builds and TypeScript pass.
- Backend regression suite: 49/49 pass with `--basetemp .pytest_cache/public-demo-check`; default Windows Temp was inaccessible initially.
- Next 16.3.8, Axios 1.20.0, PostCSS 8.5.28 and Sharp/Nano ID overrides address runtime advisories. Runtime audit is clear; development Tailwind glob advisories remain.
- Dataset switching changes graph counts and quality output.
- Responsive browser checks cover desktop and 320px mobile.
- Final interaction and deployment results are also recorded in the portfolio launch report.
