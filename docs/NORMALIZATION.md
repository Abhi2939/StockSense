# Normalization notes

The initial conceptual inventory record mixed product descriptors, category labels, supplier contact details, warehouse location, stock, movements, and forecasting values. Repeating supplier and warehouse data would create update anomalies; storing lists of suppliers or stock locations in a product would violate 1NF.

- **1NF:** Store one atomic value per cell; represent every movement as one transaction row.
- **2NF:** Move supplier offer attributes to PRODUCT_SUPPLIER and stock balances to INVENTORY, keyed by their full composite keys.
- **3NF:** Store category, supplier, and warehouse descriptions with their own identifiers, removing transitive dependencies from product and stock records.
- **BCNF:** Each determinant for the stated functional dependencies is a candidate key in its relation. Product/supplier pricing and lead time depend on the whole pair; stock values depend on the whole product/warehouse pair.

This removes repeated category names per product, supplier contact information per offer, warehouse address per stock item, and repeated product descriptors in movement and analysis facts. The schema retains the assignment's nine relations; the daily-sales view is derived and stores no additional entity.
