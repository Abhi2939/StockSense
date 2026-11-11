# Entity relationship diagram

```mermaid
erDiagram
  CATEGORY ||--o{ PRODUCT : classifies
  PRODUCT ||--o{ PRODUCT_SUPPLIER : sourced_from
  SUPPLIER ||--o{ PRODUCT_SUPPLIER : offers
  PRODUCT ||--o{ INVENTORY : stocked_as
  WAREHOUSE ||--o{ INVENTORY : holds
  PRODUCT ||--o{ TRANSACTION : moves
  WAREHOUSE ||--o{ TRANSACTION : records
  PRODUCT ||--o{ CONSUMPTION_TREND : trends
  WAREHOUSE ||--o{ CONSUMPTION_TREND : trends
  CONSUMPTION_TREND ||--|| REORDER_PREDICTION : predicts
```

The diagram contains the exact nine core relations. PRODUCT_SUPPLIER resolves product/supplier M:N; INVENTORY resolves product/warehouse M:N. TRANSACTION references both product and warehouse with required foreign keys.
