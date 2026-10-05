# Graphify AI Architecture

Tài liệu này là bản đồ nhanh cho mọi phiên làm việc. Trước khi sửa repo, agent phải đọc file này cùng `docs/implement-notes.html`.

## Mục tiêu sản phẩm

Graphify AI là nền tảng hỗ trợ chuyển dữ liệu bảng CSV thành mô hình graph có thể giải thích, đánh giá chất lượng, trực quan hóa và export code khởi đầu cho graph analytics/GNN. Phạm vi hiện tại tập trung vào demo local và nghiên cứu: single-table event datasets có nhiều cột entity ID lặp lại như giao dịch gian lận, rating, đơn hàng, sinh viên-khóa học, access log.

## Public demo cho HR

- `frontend/src/app/demo/page.tsx` tái sử dụng GraphExplorer và QualityPanel với snapshot fixture tổng hợp.
- Chạy `.venv/Scripts/python.exe scripts/export_public_demo.py` để tạo `frontend/src/data/public-demo.json` bằng chính DataProfiler, RuleBasedSchemaRecommender, GraphBuilder và GraphQualityScorer.
- Generator chỉ đọc ba fixture được whitelist trong `backend/tests/fixtures`; không đọc uploads, DB hoặc env.
- Vercel deploy riêng thư mục `frontend`, `NEXT_PUBLIC_PUBLIC_DEMO=true` chuyển các route backend-dependent về `/demo`.
- Hosted demo không hỗ trợ upload, AI/LLM, tài khoản hay persistence. Full app local không đổi khi biến public demo không được đặt.

## Stack hiện tại

- Frontend: Next.js 16 App Router, React 18, TypeScript, TailwindCSS, `lucide-react`.
- Backend: FastAPI, Python 3.11+, Pandas, NetworkX, SQLAlchemy, Pydantic.
- Storage MVP: SQLite metadata tại `backend/graphify.db`, file upload tại `backend/uploads`, export tại `backend/exports`.
- AI: rule-based schema recommender, OpenAI-compatible LLM mode tùy chọn, heuristic fallback mặc định.
- Infra: Docker Compose, GitHub Actions CI, script smoke test.
- Deployment target: Vercel frontend, Render backend Docker service, Render Postgres, Render persistent disk.
- Trạng thái vận hành: demo fixture công khai tại https://graphify-khanh-demo.vercel.app/demo; full backend vẫn local native hoặc Docker Compose.

## Cấu trúc repo

- `backend/app/main.py`: khởi tạo FastAPI, middleware, CORS, runtime folders, database, và mount router.
- `backend/app/config.py`: biến môi trường và kiểm tra runtime production.
- `backend/app/database.py`: SQLAlchemy engine/session, tạo bảng và migration SQLite tối thiểu.
- `backend/app/models`: model SQLAlchemy cho project, user, API key.
- `backend/app/schemas`: Pydantic contracts cho dataset profile, graph schema/preview, quality report, auth, experiment, project.
- `backend/app/routers`: API layer, hầu hết dưới `/api/v1`; `public_api` có public API surface riêng.
- `backend/app/services`: business logic cho profiling, schema recommendation, graph build, quality scoring, AI schema, export code, baseline, auth, API keys, project helpers.
- `backend/tests`: pytest suite và fixture CSV demo.
- `frontend/src/app`: Next.js routes cho landing, upload, projects, project dashboard, shared report, auth, settings.
- `frontend/src/components`: shared UI như `AppHeader`, `GraphExplorer`, `QualityPanel`.
- `frontend/src/lib/api.ts`: Axios client mặc định trỏ tới `http://127.0.0.1:8000/api/v1`.
- `frontend/src/types`: TypeScript types khớp backend schemas.
- `scripts/smoke_test.py`: kiểm tra luồng API chính end-to-end.
- `render.yaml`: Render Blueprint cho backend Docker service, Postgres và persistent disk.
- `.github/workflows`: CI và workflow deploy production.
- `docs`: demo walkthrough, deployment guide, screenshots, architecture memory, implementation notes.
- Roadmap phase trước đây đã được gom vào README/documentation; không còn giữ các file `phase*.md` ở root.

## Luồng chính

1. User mở `/upload`, chọn demo dataset hoặc upload CSV.
2. Backend lưu file vào `backend/uploads` và tạo `Project`.
3. `DataProfiler` đọc CSV bằng Pandas, suy luận role cột: id, timestamp, label, numerical, categorical, text.
4. `RuleBasedSchemaRecommender` tạo tối đa 3 graph schema: minimal bipartite, transaction-centered, full heterogeneous.
5. `GraphQualityScorer` chấm suitability, entity/relationship confidence, feature richness, task suitability, connectivity, interpretability, leakage warnings.
6. Dashboard `/projects/[id]` lấy project, report, schema, quality; user có thể chạy AI schema, explanation, graph preview, baseline, export, share.
7. `GraphBuilder` dựng sample graph bằng NetworkX `MultiDiGraph` và trả node/edge preview cho `GraphExplorer`.
8. Experiment baseline chạy heuristic nhẹ cho demo supervised/anomaly ranking.
9. Export tạo bundle schema, graph tables, NetworkX/PyG starter code, notebook.
10. Share tạo read-only token cho `/s/[token]`.

## Backend API chính

- Health/status: `/health`, `/api/v1/health`, `/api/v1/system/status`.
- Demo: `/api/v1/demo-datasets`, `/api/v1/demo-datasets/{id}/project`.
- Upload/profile/schema: `/api/v1/upload`, `/api/v1/profile/{project_id}`, `/api/v1/schema/recommend/{project_id}`.
- Project/report/share: `/api/v1/projects`, `/api/v1/projects/{project_id}`, `/api/v1/projects/{project_id}/report`, `/api/v1/projects/{project_id}/share`.
- AI schema: `/api/v1/ai/schema/analyze/{project_id}`, `/api/v1/ai/schema/explain`.
- Graph/quality/experiment/export: `/api/v1/graph/build/{project_id}`, `/api/v1/quality/{project_id}`, `/api/v1/experiments/baseline/{project_id}`, `/api/v1/export/{project_id}`.
- Auth/productization: auth, API keys, public API routes đang ở mức basic implementation.

## Cấu hình môi trường

Backend `.env` quan trọng:

```env
DATABASE_URL=sqlite:///backend/graphify.db
UPLOAD_DIR=backend/uploads
EXPORT_DIR=backend/exports
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
AI_SCHEMA_MODE=heuristic
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=local-heuristic
SECRET_KEY=change-this-in-production
```

Frontend dùng `NEXT_PUBLIC_API_URL`, mặc định là `http://127.0.0.1:8000/api/v1`.

Public-repo safety:

- Local credential files dùng quy ước `.env`, `.env.*`; chỉ các template `*.env.example` được version control.
- `NEXT_PUBLIC_*` là client-visible nên chỉ dùng cho API URL công khai, không chứa token, API key, `SECRET_KEY` hay `DATABASE_URL`.
- Trước khi public repo, kiểm tra cả Git history vì email commit và credential từng commit vẫn có thể bị lộ dù file hiện tại đã bị xóa.

Production target:

- Backend chạy trên Render Docker service, đọc `PORT` từ hosting platform.
- `DATABASE_URL` dùng Render Postgres hoặc URL Postgres tương thích SQLAlchemy.
- Upload/export production dùng persistent disk tại `/var/data/uploads` và `/var/data/exports`.
- `ALLOWED_ORIGINS` production phải là deployed frontend URL, không dùng localhost hoặc wildcard.
- Frontend Vercel dùng `NEXT_PUBLIC_API_URL=https://graphiai-api.onrender.com/api/v1` hoặc URL backend production thực tế.

## Lệnh chạy local

Backend:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m pytest
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```powershell
$env:PATH = "$PWD\.tools\node-v20.12.2-win-x64;$env:PATH"
cd frontend
npm install
npm run typecheck
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Full stack:

```powershell
docker compose up --build
```

Smoke test khi backend đang chạy:

```powershell
.\.venv\Scripts\python.exe .\scripts\smoke_test.py --api-url http://127.0.0.1:8000/api/v1
```

## Quy tắc thay đổi kiến trúc

- Nếu thay đổi cách chạy, API contract, data flow, storage, dependency, route, service boundary, hoặc workflow người dùng, cập nhật file này ngay trong cùng commit.
- Nếu đụng mã nguồn hoặc cấu hình, ghi card mới trong `docs/implement-notes.html` bằng tiếng Việt.
- Không commit runtime data: `backend/uploads/*`, `backend/exports/*`, `backend/graphify.db`, `.next/`, `node_modules/`, cache.
- Chia refactor lớn thành nhiều commit nhỏ, mỗi commit có note tương ứng và kiểm chứng phù hợp.

## Production gaps đã biết

- Hosted deployment chưa được thực hiện. Repo có cấu hình Render/Vercel và workflow CD, nhưng vẫn cần thiết lập dashboard, secrets và post-deploy smoke test thực tế.
- Persistent rate-limit store, observability dashboards, object storage, access-control hardening, và graph ML experiment infrastructure nghiêm túc vẫn đang pending.
- SQLite/local files phù hợp demo local, chưa phải kiến trúc production.
- AI LLM mode phải luôn có fallback heuristic và validation để tránh output hallucinated.

## Xử lý conflict tài liệu

Khi merge conflict trong `docs/implement-notes.html`, không xóa card hợp lệ. Giải quyết theo thứ tự:

1. Tách từng card note còn nguyên timestamp.
2. Sắp xếp card theo timestamp giảm dần.
3. Nếu nhiều card nói về cùng một quyết định, đánh giá hiệu quả thực tế của từng thay đổi và ghi rõ phương án giữ/sửa.
4. Chỉ sau khi đánh giá mới chỉnh nội dung hợp nhất.
