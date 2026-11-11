# StockSense — Predictive Restocking Inventory Management System

StockSense is an academic inventory DBMS application built around a normalized nine-table MySQL schema and SQL-only demand analytics. It uses FastAPI, SQLAlchemy, React, Vite, Tailwind, Recharts, and MySQL 8.0.

## Run with Docker

1. Copy `.env.example` to `.env` and change the passwords for your environment.
2. Start the stack: `docker compose up --build`
3. Open the dashboard at `http://localhost:8080`; API docs are at `http://localhost:8000/docs`.

MySQL loads `database/schema.sql`, `database/seed.sql`, and `database/views.sql` on the first volume initialization. To reset the demo database and seed data, run `docker compose down -v` then `docker compose up --build` (this removes the database volume).

## Manual development

- Initialize a MySQL 8 server and run `database/schema.sql`, `database/seed.sql`, then `database/views.sql` in that order.
- Set `DATABASE_URL` to a PyMySQL SQLAlchemy URL and `ALLOWED_ORIGINS` to the frontend origin.
- Backend: `cd backend`, create a virtual environment, install with `pip install -r requirements.txt`, then run `uvicorn app.main:app --reload`.
- Frontend: `cd frontend`, run `npm install` then `npm run dev`; Vite proxies `/api` to localhost:8000.

## Validation

With MySQL seeded and the backend dependencies installed, run `cd backend && pytest`. Integration tests cover connectivity, seeded catalogue/locations, and transaction validation. Compose syntax and Python compilation can also be checked with `docker compose config` and `python -m compileall -q backend/app`.

## Sample data and analysis

The seed script is resettable and gives each fresh install a recent 21-day sample with deterministic demand patterns. It uses the product/category, supplier, warehouse, and six product-location examples from the assignment prompt. Supplier offer details and inventory thresholds use demo values because Appendix A itself was not included in this repository or prompt. The patterns demonstrate all three demand directions but cannot assert an exact match to omitted Appendix A rows. Select **Generate predictions** in the dashboard or call `POST /api/predictions/generate` to create a current snapshot.

## API and features

See [API documentation](docs/API_DOCUMENTATION.md), [database design](docs/DATABASE_DESIGN.md), [ER diagram](docs/ER_DIAGRAM.md), [normalization](docs/NORMALIZATION.md), and [SQL requirements](docs/SQL_QUERIES.md). The dashboard includes product create/update/delete, ranked supplier offers, location stock and capacity, filtered transaction history, atomic stock movements, calendar-complete moving averages, weekly changes, regression trends, persistent predictions, purchase alerts, and a static/predictive comparison.

## Notes

MySQL initialization scripts run only when the data volume is empty. API analytical endpoints require MySQL 8.0 window functions and CTE support. The prediction endpoint snapshots one trend per product/location and analysis date; a unique trend-period key makes rerunning a date idempotent while preserving earlier dates.
