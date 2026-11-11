USE stocksense;
WITH ranked AS (
 SELECT product_id,supplier_id,supply_price,lead_time_days,
 ROW_NUMBER() OVER(PARTITION BY product_id ORDER BY lead_time_days,supply_price) supplier_rank
 FROM PRODUCT_SUPPLIER
)
SELECT i.product_id,i.warehouse_id,i.quantity_on_hand,i.safety_stock,t.moving_avg,t.trend_slope,
 r.supplier_id,r.supply_price,r.lead_time_days,
 CASE WHEN t.moving_avg>0 THEN CURRENT_DATE+INTERVAL FLOOR(i.quantity_on_hand/t.moving_avg) DAY END predicted_stockout_date,
 CASE WHEN t.moving_avg>0 THEN CURRENT_DATE+INTERVAL FLOOR((i.quantity_on_hand-i.safety_stock)/t.moving_avg) DAY-INTERVAL r.lead_time_days DAY END reorder_date,
 GREATEST(0,CEIL((t.moving_avg+GREATEST(t.trend_slope,0)*r.lead_time_days)*(r.lead_time_days+14)+i.safety_stock-i.quantity_on_hand)) recommended_order_qty
FROM INVENTORY i JOIN CONSUMPTION_TREND t USING(product_id,warehouse_id)
LEFT JOIN ranked r ON r.product_id=i.product_id AND r.supplier_rank=1;
