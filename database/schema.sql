CREATE DATABASE IF NOT EXISTS stocksense CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE stocksense;

CREATE TABLE IF NOT EXISTS CATEGORY (
  category_id VARCHAR(12) PRIMARY KEY,
  category_name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS PRODUCT (
  product_id VARCHAR(12) PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  product_name VARCHAR(140) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL CHECK (unit_cost >= 0),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  category_id VARCHAR(12) NOT NULL,
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES CATEGORY(category_id),
  INDEX idx_product_category (category_id)
);
CREATE TABLE IF NOT EXISTS SUPPLIER (
  supplier_id VARCHAR(12) PRIMARY KEY,
  supplier_name VARCHAR(120) NOT NULL UNIQUE,
  contact_email VARCHAR(254),
  phone VARCHAR(40)
);
CREATE TABLE IF NOT EXISTS PRODUCT_SUPPLIER (
  product_id VARCHAR(12) NOT NULL,
  supplier_id VARCHAR(12) NOT NULL,
  supply_price DECIMAL(12,2) NOT NULL CHECK (supply_price >= 0),
  lead_time_days INT NOT NULL CHECK (lead_time_days > 0),
  PRIMARY KEY (product_id, supplier_id),
  FOREIGN KEY (product_id) REFERENCES PRODUCT(product_id),
  FOREIGN KEY (supplier_id) REFERENCES SUPPLIER(supplier_id),
  INDEX idx_ps_supplier (supplier_id)
);
CREATE TABLE IF NOT EXISTS WAREHOUSE (
  warehouse_id VARCHAR(12) PRIMARY KEY,
  warehouse_name VARCHAR(120) NOT NULL UNIQUE,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0)
);
CREATE TABLE IF NOT EXISTS INVENTORY (
  product_id VARCHAR(12) NOT NULL,
  warehouse_id VARCHAR(12) NOT NULL,
  quantity_on_hand INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_point INT NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  safety_stock INT NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  PRIMARY KEY (product_id, warehouse_id),
  FOREIGN KEY (product_id) REFERENCES PRODUCT(product_id),
  FOREIGN KEY (warehouse_id) REFERENCES WAREHOUSE(warehouse_id),
  INDEX idx_inventory_warehouse (warehouse_id)
);
CREATE TABLE IF NOT EXISTS `TRANSACTION` (
  transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  transaction_type ENUM('SALE','RESTOCK','ADJUSTMENT') NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  product_id VARCHAR(12) NOT NULL,
  warehouse_id VARCHAR(12) NOT NULL,
  FOREIGN KEY (product_id) REFERENCES PRODUCT(product_id),
  FOREIGN KEY (warehouse_id) REFERENCES WAREHOUSE(warehouse_id),
  INDEX idx_tx_date (transaction_date),
  INDEX idx_tx_product_warehouse (product_id, warehouse_id),
  INDEX idx_tx_type_date (transaction_type, transaction_date)
);
CREATE TABLE IF NOT EXISTS CONSUMPTION_TREND (
  trend_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(12) NOT NULL,
  warehouse_id VARCHAR(12) NOT NULL,
  period_start DATE NOT NULL,
  moving_avg DECIMAL(14,4) NOT NULL CHECK (moving_avg >= 0),
  trend_slope DECIMAL(14,6) NOT NULL,
  avg_daily_usage DECIMAL(14,4) NOT NULL CHECK (avg_daily_usage >= 0),
  UNIQUE KEY uq_trend_period (product_id, warehouse_id, period_start),
  FOREIGN KEY (product_id) REFERENCES PRODUCT(product_id),
  FOREIGN KEY (warehouse_id) REFERENCES WAREHOUSE(warehouse_id),
  INDEX idx_trend_warehouse (warehouse_id)
);
CREATE TABLE IF NOT EXISTS REORDER_PREDICTION (
  prediction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  trend_id BIGINT NOT NULL UNIQUE,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  predicted_stockout_date DATE NULL,
  recommended_order_qty INT NOT NULL CHECK (recommended_order_qty >= 0),
  reorder_date DATE NULL,
  FOREIGN KEY (trend_id) REFERENCES CONSUMPTION_TREND(trend_id)
);
