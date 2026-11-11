USE stocksense;
WITH RECURSIVE calendar AS (
 SELECT CAST('2026-10-13' AS DATE) d UNION ALL SELECT d+INTERVAL 1 DAY FROM calendar WHERE d<'2026-11-02'
), dense AS (
 SELECT c.d sale_date,i.product_id,i.warehouse_id,COALESCE(v.units_sold,0) units_sold
 FROM calendar c CROSS JOIN INVENTORY i LEFT JOIN v_daily_sales v
 ON v.sale_date=c.d AND v.product_id=i.product_id AND v.warehouse_id=i.warehouse_id
), moving AS (
 SELECT *,AVG(units_sold) OVER(PARTITION BY product_id,warehouse_id ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) moving_avg
 FROM dense
)
SELECT * FROM moving ORDER BY sale_date,product_id,warehouse_id;

WITH weekly AS (
 SELECT product_id,warehouse_id,YEARWEEK(sale_date,3) week_id,SUM(units_sold) units
 FROM v_daily_sales GROUP BY product_id,warehouse_id,YEARWEEK(sale_date,3)
), prior AS (
 SELECT *,LAG(units) OVER(PARTITION BY product_id,warehouse_id ORDER BY week_id) previous_units FROM weekly
)
SELECT *,ROUND((units-previous_units)*100/NULLIF(previous_units,0),2) wow_change_pct FROM prior;

WITH numbered AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY product_id,warehouse_id ORDER BY sale_date) x FROM v_daily_sales
)
SELECT product_id,warehouse_id,COUNT(*) observations,AVG(units_sold) avg_daily_usage,
 (COUNT(*)*SUM(x*units_sold)-SUM(x)*SUM(units_sold))/NULLIF(COUNT(*)*SUM(x*x)-SUM(x)*SUM(x),0) trend_slope
FROM numbered GROUP BY product_id,warehouse_id;
