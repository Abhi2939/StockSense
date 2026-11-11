USE stocksense;
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT DATE(transaction_date) AS sale_date, product_id, warehouse_id,
       SUM(quantity) AS units_sold
FROM `TRANSACTION`
WHERE transaction_type = 'SALE'
GROUP BY DATE(transaction_date), product_id, warehouse_id;

CREATE OR REPLACE VIEW v_inventory_status AS
SELECT i.product_id, p.sku, p.product_name, i.warehouse_id, w.warehouse_name,
       i.quantity_on_hand, i.reorder_point, i.safety_stock,
       CASE WHEN i.quantity_on_hand <= i.reorder_point THEN 'REORDER' ELSE 'OK' END AS static_status
FROM INVENTORY i JOIN PRODUCT p ON p.product_id=i.product_id
JOIN WAREHOUSE w ON w.warehouse_id=i.warehouse_id;
