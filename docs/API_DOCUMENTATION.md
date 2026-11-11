# API

All routes use the `/api` prefix. Interactive OpenAPI documentation is at `/docs`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Database health |
| GET, POST | `/products` | Catalogue and product create |
| PUT, DELETE | `/products/{product_id}` | Product update/delete |
| GET | `/categories` | Category options |
| GET | `/suppliers`, `/supplier-rankings` | Suppliers and ranked offers |
| GET | `/warehouses` | Capacity utilization |
| GET | `/inventory` | Location stock and static status |
| GET, POST | `/transactions` | Filter history and atomically record movement |
| GET | `/transaction-summary` | Conditional aggregation by product/location |
| GET | `/consumption/daily` | Calendar-complete daily units and moving average |
| GET | `/analytics/weekly` | Week-over-week changes |
| GET | `/analytics/trends` | Slope, usage and direction |
| GET | `/dashboard` | Database-backed KPIs, chart data, and alerts |
| POST | `/predictions/generate?analysis_date=YYYY-MM-DD` | Persist trends and predictions |
| GET | `/alerts` | Latest prioritized purchasing report; filters: `product_id`, `warehouse_id`, `urgency`, `supplier_id`, `start`, and `end` |
| GET | `/comparison` | Static versus predictive early warnings |

Transaction body: `{"product_id":"P101","warehouse_id":"W1","transaction_type":"SALE","quantity":2}`. Product create/update fields match the PRODUCT table. Filters accept product, warehouse, type and date values on `/transactions`; daily analytics accept product, warehouse, start and end.

The React dashboard exposes product creation, editing, and deletion, stock movements, supplier offer rankings, inventory and warehouse views, searchable transaction history, demand charts, weekly changes, trend analysis, alerts, and static-versus-predictive comparisons. Inventory movements use the exact product/warehouse pair selected in the form. Alert and inventory views use the newest prediction snapshot for each product and warehouse.
