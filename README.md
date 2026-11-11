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

The seed script is deterministic and resettable. It uses the product/category, supplier, warehouse, and six product-location examples from the assignment prompt, with explicit deterministic daily patterns. Supplier offer details and inventory thresholds are populated with demo values because Appendix A itself was not included in this repository or prompt. The pattern data therefore demonstrates all three demand directions but cannot assert an exact match to omitted Appendix A rows. Generate a snapshot with `POST /api/predictions/generate?analysis_date=2026-11-03`; production default uses today's date.

## API and features

See [API documentation](docs/API_DOCUMENTATION.md), [database design](docs/DATABASE_DESIGN.md), [ER diagram](docs/ER_DIAGRAM.md), [normalization](docs/NORMALIZATION.md), and [SQL requirements](docs/SQL_QUERIES.md). The application provides catalogue CRUD, supplier ranking, capacity utilization, inventory views, filtered transaction history and atomic inventory movements, calendar-complete moving averages, weekly changes, regression trends, persistent predictions, purchasing alerts, and static/predictive comparison.

## Notes

MySQL initialization scripts run only when the data volume is empty. API analytical endpoints require MySQL 8.0 window functions and CTE support. The prediction endpoint snapshots one trend per product/location and analysis date; a unique trend-period key makes rerunning a date idempotent while preserving earlier dates.
