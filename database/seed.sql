USE stocksense;
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE TABLE REORDER_PREDICTION;
TRUNCATE TABLE CONSUMPTION_TREND;
TRUNCATE TABLE `TRANSACTION`;
TRUNCATE TABLE INVENTORY;
TRUNCATE TABLE PRODUCT_SUPPLIER;
TRUNCATE TABLE PRODUCT;
TRUNCATE TABLE SUPPLIER;
TRUNCATE TABLE WAREHOUSE;
TRUNCATE TABLE CATEGORY;
SET FOREIGN_KEY_CHECKS=1;

INSERT INTO CATEGORY VALUES ('C1','Medicines','Over-the-counter medicines'),('C2','Personal Care','Daily personal care products');
INSERT INTO PRODUCT VALUES
('P101','SKU-P101','Paracetamol 500mg',12,18,'C1'),('P102','SKU-P102','Cough Syrup 100ml',40,55,'C1'),
('P103','SKU-P103','Hand Sanitizer 250ml',48,70,'C2'),('P104','SKU-P104','Ibuprofen 400mg',13,19,'C1');
INSERT INTO SUPPLIER VALUES ('S1','Medico Ltd','orders@medico.example','+91-172-555-0101'),('S2','HealthSupply','sales@healthsupply.example','+91-172-555-0102');
INSERT INTO PRODUCT_SUPPLIER VALUES
('P101','S1',10,3),('P101','S2',9.5,5),('P102','S1',36,4),('P102','S2',35,6),
('P103','S1',44,5),('P103','S2',42,7),('P104','S1',11,3),('P104','S2',10.5,5);
INSERT INTO WAREHOUSE VALUES ('W1','Patiala Central','Patiala','Punjab',5000),('W2','Ludhiana Hub','Ludhiana','Punjab',8000);
INSERT INTO INVENTORY VALUES
('P101','W1',240,180,120),('P101','W2',190,120,80),('P102','W1',220,100,60),
('P102','W2',110,90,50),('P103','W1',160,100,80),('P104','W2',55,50,30);
-- Place the opening delivery just before the 21-day sales sample so a fresh install
-- always starts with recent demand data, regardless of when the project is run.
SELECT DATE_SUB(CURRENT_DATE, INTERVAL 22 DAY) INTO @seed_restock_date;
INSERT INTO `TRANSACTION` (transaction_date,transaction_type,quantity,product_id,warehouse_id) VALUES
(@seed_restock_date,'RESTOCK',567,'P101','W1'),(@seed_restock_date,'RESTOCK',316,'P101','W2'),
(@seed_restock_date,'RESTOCK',398,'P102','W1'),(@seed_restock_date,'RESTOCK',256,'P102','W2'),
(@seed_restock_date,'RESTOCK',435,'P103','W1'),(@seed_restock_date,'RESTOCK',137,'P104','W2');

-- Deterministic 21-day patterns; opening restocks reconcile to ending inventory after sales.
INSERT INTO `TRANSACTION` (transaction_date,transaction_type,quantity,product_id,warehouse_id)
WITH RECURSIVE days AS (
  SELECT 0 AS n UNION ALL SELECT n+1 FROM days WHERE n < 20
), patterns AS (
  SELECT 'P101' AS product_id,'W1' AS warehouse_id, 1 AS pattern_id UNION ALL
  SELECT 'P101','W2',2 UNION ALL SELECT 'P102','W1',3 UNION ALL
  SELECT 'P102','W2',4 UNION ALL SELECT 'P103','W1',5 UNION ALL SELECT 'P104','W2',6
)
SELECT DATE_ADD(DATE_SUB(CURRENT_DATE, INTERVAL 21 DAY), INTERVAL days.n DAY), 'SALE',
       CASE pattern_id
         WHEN 1 THEN 8 + FLOOR(days.n * 0.7) + MOD(days.n,3)
         WHEN 2 THEN 5 + MOD(days.n,3)
         WHEN 3 THEN 8 + MOD(days.n,2)
         WHEN 4 THEN GREATEST(1, 10 - FLOOR(days.n * 0.3) - MOD(days.n,2))
         WHEN 5 THEN 7 + FLOOR(days.n * 0.6) + MOD(days.n,2)
         ELSE 2 + MOD(days.n,5)
       END,
       patterns.product_id, patterns.warehouse_id
FROM days CROSS JOIN patterns;
