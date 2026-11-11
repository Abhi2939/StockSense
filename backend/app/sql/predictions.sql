USE stocksense;
-- Prediction persistence is performed by the API in one SQLAlchemy transaction.
WITH preferred_supplier AS (
 SELECT product_id,supplier_id,supply_price,lead_time_days,
 ROW_NUMBER() OVER(PARTITION BY product_id ORDER BY lead_time_days,supply_price) supplier_rank
 FROM PRODUCT_SUPPLIER
)
SELECT i.product_id,i.warehouse_id,i.quantity_on_hand,i.safety_stock,t.moving_avg,t.trend_slope,
 ps.supplier_id,ps.lead_time_days,
 DATE_ADD(CURRENT_DATE,INTERVAL FLOOR(i.quantity_on_hand/NULLIF(t.moving_avg,0)) DAY) predicted_stockout_date,
 DATE_SUB(DATE_ADD(CURRENT_DATE,INTERVAL FLOOR((i.quantity_on_hand-i.safety_stock)/NULLIF(t.moving_avg,0)) DAY),INTERVAL ps.lead_time_days DAY) reorder_date,
 GREATEST(0,CEIL((t.moving_avg+GREATEST(t.trend_slope,0)*ps.lead_time_days)*(ps.lead_time_days+14)+t.safety_stock-i.quantity_on_hand)) recommended_order_qty
FROM INVENTORY i JOIN CONSUMPTION_TREND t USING(product_id,warehouse_id)
LEFT JOIN preferred_supplier ps ON ps.product_id=i.product_id AND ps.supplier_rank=1;
