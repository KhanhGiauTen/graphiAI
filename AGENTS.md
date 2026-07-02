# Graphify AI Agent Rules

Quy tac nay ap dung cho moi agent lam viec trong repo Graphify AI.

## Bat dau moi phien

1. Doc `docs/ARCHITECTURE.md` de nam kien truc, luong san pham, stack, lenh chay va cac ranh gioi thiet ke hien tai.
2. Doc `docs/implement-notes.html` de biet cac thay doi, quyet dinh va danh gia gan nhat.
3. Kiem tra `git status --short --branch` truoc khi sua file. Khong revert thay doi khong phai cua minh neu khong duoc yeu cau ro.

## Ghi note bat buoc

- Moi thay doi cham toi ma nguon, cau truc project, cau hinh, workflow, dependency, API contract, database/storage, UI flow, test, hoac tai lieu kien truc deu phai co note trong `docs/implement-notes.html`.
- Note viet bang tieng Viet, dang card HTML, card moi nhat nam tren cung.
- Header cua moi card phai co thoi gian note va nguoi note. Lay nguoi note tu `git config user.name`; neu thieu thi dung GitHub username suy ra tu remote `origin`.
- Moi card nen co: pham vi, quyet dinh/thay doi, ly do, tac dong, kiem chung, va buoc review neu can.
- Khi merge conflict trong `docs/implement-notes.html`, giu lai tat ca card hop le, sap xep theo timestamp moi nhat truoc, danh gia hieu qua/ket qua cua cac note trung nhau, roi moi chon phuong an hop nhat.

## Cap nhat kien truc

- Cap nhat `docs/ARCHITECTURE.md` ngay khi co thay doi ve cach chay, cach dung, luong API/UI, data flow, storage, dependency, ranh gioi module, hoac quyet dinh kien truc.
- `docs/ARCHITECTURE.md` la ban do nhanh cho phien sau; viet ngan gon nhung du thong tin de khong can quet toan repo.
- Neu chi sua noi dung nho khong doi kien truc, van ghi note vao `docs/implement-notes.html`; khong can sua `ARCHITECTURE.md` neu khong co thong tin kien truc moi.

## Quy trinh lam viec

- Uu tien thay doi nho, commit rieng theo tung nhom y nghia, va push len remote khi task da duoc kiem chung va user yeu cau/da thiet lap thoi quen lam viec do.
- Khong dua artifact runtime vao commit: `backend/uploads/*`, `backend/exports/*`, `backend/graphify.db`, `.next/`, `node_modules/`, cache.
- Khi cham backend: uu tien test lien quan bang `cd backend; ..\.venv\Scripts\python.exe -m pytest`.
- Khi cham frontend: uu tien `cd frontend; npm run typecheck`; voi thay doi UI/production nen chay them `npm run build`.
- Khi cham flow end-to-end: chay smoke test sau khi backend dang chay: `.\.venv\Scripts\python.exe .\scripts\smoke_test.py --api-url http://127.0.0.1:8000/api/v1`.

## Huong phat trien dai han

- Muc tieu chinh cua repo la phuc vu nghien cuu va demo graph ML tu du lieu bang. Co the tai cau truc lon neu no lam ro kien truc, tang kha nang nghien cuu, hoac giam no ky thuat.
- Moi lan tai cau truc phai chia thanh cac buoc nho, co note ro rang, cap nhat kien truc, chay test phu hop, commit rieng va push.
