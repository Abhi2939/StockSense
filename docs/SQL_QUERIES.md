# SQL requirements mapping

1. Catalogue: PRODUCT JOIN CATEGORY; margin is unit_price − unit_cost.
2. Supplier ranking: RANK() partitioned by product over lead time and price.
3. Static status: quantity_on_hand compared to reorder_point in v_inventory_status.
4. Warehouse capacity: LEFT JOIN, SUM, GROUP BY and capacity ratio.
5. Movement summary: SUM(CASE...) with transaction count and first/last dates.
6. Daily sales: v_daily_sales and a calendar-complete CTE; seven rows represent seven calendar days.
7. Weekly comparison: YEARWEEK aggregate with LAG and NULLIF division.
8. Trend: ROW_NUMBER day index and least-squares aggregate slope; thresholds >.20 and <−.10.
9. Trend persistence: prediction-generation CTE stores per-product/location snapshots by analysis period.
10. Predictions: SQL date arithmetic, fastest supplier, nonnegative CEIL order quantity; inserts are one transaction.
11. Alerts: supplier ROW_NUMBER, estimated unit price extension, urgency and date sorting.
12. Comparison: static OK paired with a prediction due within three days.

Analytical SQL is also available in `backend/app/sql/analytics.sql` and `backend/app/sql/predictions.sql`; executable service queries live in `backend/app/main.py`.
