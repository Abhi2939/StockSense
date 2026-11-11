# Database design

| Relation | Primary key | Foreign keys |
|---|---|---|
| CATEGORY | category_id | — |
| PRODUCT | product_id | category_id → CATEGORY |
| SUPPLIER | supplier_id | — |
| PRODUCT_SUPPLIER | (product_id, supplier_id) | product_id → PRODUCT; supplier_id → SUPPLIER |
| WAREHOUSE | warehouse_id | — |
| INVENTORY | (product_id, warehouse_id) | product_id → PRODUCT; warehouse_id → WAREHOUSE |
| TRANSACTION | transaction_id | product_id → PRODUCT; warehouse_id → WAREHOUSE |
| CONSUMPTION_TREND | trend_id | product_id → PRODUCT; warehouse_id → WAREHOUSE |
| REORDER_PREDICTION | prediction_id | unique trend_id → CONSUMPTION_TREND |

Principal dependencies: category_id → category_name, description; product_id → sku, product_name, unit_cost, unit_price, category_id; supplier_id → supplier_name, contact_email, phone; warehouse_id → warehouse_name, city, state, capacity; (product_id,supplier_id) → supply_price, lead_time_days; (product_id,warehouse_id) → quantity_on_hand, reorder_point, safety_stock. A trend_id determines its product/location/period metrics and its unique prediction determines prediction attributes.

All identifiers are NOT NULL by primary-key definition; required relationships and transactional facts are NOT NULL. Prices and stock amounts have nonnegative checks; transaction quantity, lead time, and capacity are positive. Composite foreign keys are indexed by their leading keys.
