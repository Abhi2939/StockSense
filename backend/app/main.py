import os
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from .database import SessionLocal

app = FastAPI(title="StockSense Predictive Restocking API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class Movement(BaseModel):
    product_id: str
    warehouse_id: str
    transaction_type: Literal["SALE", "RESTOCK", "ADJUSTMENT"]
    quantity: int = Field(gt=0)

class ProductIn(BaseModel):
    product_id: str
    sku: str
    product_name: str
    unit_cost: float = Field(ge=0)
    unit_price: float = Field(ge=0)
    category_id: str

def rows(sql: str, params: dict | None = None):
    with SessionLocal() as db:
        return [dict(r) for r in db.execute(text(sql), params or {}).mappings().all()]

@app.get("/api/health")
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}

@app.get("/api/products")
def products():
    return rows("""SELECT p.product_id,p.sku,p.product_name,p.unit_cost,p.unit_price,(p.unit_price-p.unit_cost) AS profit_margin,c.category_name
                 FROM PRODUCT p JOIN CATEGORY c USING(category_id) ORDER BY p.product_name""")

@app.post("/api/products", status_code=201)
def create_product(item: ProductIn):
    try:
        with SessionLocal.begin() as db:
            db.execute(text("INSERT INTO PRODUCT(product_id,sku,product_name,unit_cost,unit_price,category_id) VALUES(:product_id,:sku,:product_name,:unit_cost,:unit_price,:category_id)"), item.model_dump())
    except IntegrityError as exc:
        raise HTTPException(409, "Product ID, SKU, or category conflicts with existing data") from exc
    return item.model_dump()

@app.put("/api/products/{product_id}")
def update_product(product_id: str, item: ProductIn):
    if item.product_id != product_id:
        raise HTTPException(400, "Product ID must match the URL")
    try:
        with SessionLocal.begin() as db:
            result = db.execute(text("UPDATE PRODUCT SET sku=:sku,product_name=:product_name,unit_cost=:unit_cost,unit_price=:unit_price,category_id=:category_id WHERE product_id=:product_id"), item.model_dump())
            if not result.rowcount:
                raise HTTPException(404, "Product not found")
    except IntegrityError as exc:
        raise HTTPException(409, "SKU or category conflicts with existing data") from exc
    return item.model_dump()

@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: str):
    try:
        with SessionLocal.begin() as db:
            result=db.execute(text("DELETE FROM PRODUCT WHERE product_id=:id"), {"id":product_id})
            if not result.rowcount: raise HTTPException(404, "Product not found")
    except IntegrityError as exc: raise HTTPException(409, "Product is referenced by inventory or history") from exc

@app.get("/api/categories")
def categories(): return rows("SELECT category_id,category_name,description FROM CATEGORY ORDER BY category_name")

@app.get("/api/suppliers")
def suppliers(): return rows("SELECT supplier_id,supplier_name,contact_email,phone FROM SUPPLIER ORDER BY supplier_name")

@app.get("/api/supplier-rankings")
def supplier_rankings():
    return rows("""SELECT p.product_id,p.product_name,s.supplier_id,s.supplier_name,ps.supply_price,ps.lead_time_days,
      RANK() OVER(PARTITION BY p.product_id ORDER BY ps.lead_time_days) speed_rank,
      RANK() OVER(PARTITION BY p.product_id ORDER BY ps.supply_price) price_rank
      FROM PRODUCT_SUPPLIER ps JOIN PRODUCT p USING(product_id) JOIN SUPPLIER s USING(supplier_id)
      ORDER BY p.product_id,speed_rank,price_rank""")

@app.get("/api/warehouses")
def warehouses():
    return rows("""SELECT w.warehouse_id,w.warehouse_name,w.city,w.state,w.capacity,COALESCE(SUM(i.quantity_on_hand),0) units_stored,
      ROUND(COALESCE(SUM(i.quantity_on_hand),0)*100/w.capacity,1) percentage_used
      FROM WAREHOUSE w LEFT JOIN INVENTORY i USING(warehouse_id) GROUP BY w.warehouse_id,w.warehouse_name,w.city,w.state,w.capacity""")

@app.get("/api/inventory")
def inventory():
    return rows("""WITH ranked AS (
      SELECT t.product_id,t.warehouse_id,t.trend_slope,rp.reorder_date,
      ROW_NUMBER() OVER(PARTITION BY t.product_id,t.warehouse_id ORDER BY t.period_start DESC,t.trend_id DESC) rn
      FROM CONSUMPTION_TREND t LEFT JOIN REORDER_PREDICTION rp USING(trend_id))
      SELECT v.*,p.sku,COALESCE(r.trend_slope,0) trend_slope,r.reorder_date,
      CASE WHEN r.reorder_date <= CURRENT_DATE + INTERVAL 3 DAY THEN 'REORDER' ELSE 'OK' END predictive_status
      FROM v_inventory_status v JOIN PRODUCT p USING(product_id)
      LEFT JOIN ranked r ON r.product_id=v.product_id AND r.warehouse_id=v.warehouse_id AND r.rn=1""")

@app.get("/api/transactions")
def transactions(product_id: str|None=None, warehouse_id: str|None=None, transaction_type: str|None=None, start: date|None=None, end: date|None=None):
    return rows("""SELECT tx.transaction_id,tx.transaction_date,tx.transaction_type,tx.quantity,tx.product_id,p.product_name,tx.warehouse_id,w.warehouse_name
      FROM `TRANSACTION` tx JOIN PRODUCT p USING(product_id) JOIN WAREHOUSE w USING(warehouse_id)
      WHERE (:product_id IS NULL OR tx.product_id=:product_id) AND (:warehouse_id IS NULL OR tx.warehouse_id=:warehouse_id)
      AND (:kind IS NULL OR tx.transaction_type=:kind) AND (:start IS NULL OR tx.transaction_date>=:start)
      AND (:end IS NULL OR tx.transaction_date<DATE_ADD(:end,INTERVAL 1 DAY)) ORDER BY tx.transaction_date DESC LIMIT 1000""",
      {"product_id":product_id,"warehouse_id":warehouse_id,"kind":transaction_type,"start":start,"end":end})

@app.post("/api/transactions", status_code=201)
def record_movement(item: Movement):
    with SessionLocal.begin() as db:
        inv=db.execute(text("SELECT quantity_on_hand FROM INVENTORY WHERE product_id=:p AND warehouse_id=:w FOR UPDATE"), {"p":item.product_id,"w":item.warehouse_id}).mappings().first()
        if not inv: raise HTTPException(404, "Inventory pair not found")
        qty=item.quantity if item.transaction_type != "SALE" else -item.quantity
        if inv["quantity_on_hand"] + qty < 0: raise HTTPException(409, "Sale would make inventory negative")
        db.execute(text("UPDATE INVENTORY SET quantity_on_hand=quantity_on_hand+:delta WHERE product_id=:p AND warehouse_id=:w"), {"delta":qty,"p":item.product_id,"w":item.warehouse_id})
        db.execute(text("INSERT INTO `TRANSACTION`(transaction_date,transaction_type,quantity,product_id,warehouse_id) VALUES(NOW(),:kind,:qty,:p,:w)"), {"kind":item.transaction_type,"qty":item.quantity,"p":item.product_id,"w":item.warehouse_id})
    return {"status":"recorded"}

@app.get("/api/transaction-summary")
def transaction_summary():
    return rows("""SELECT product_id,warehouse_id,SUM(CASE WHEN transaction_type='SALE' THEN quantity ELSE 0 END) total_sold,
      SUM(CASE WHEN transaction_type='RESTOCK' THEN quantity ELSE 0 END) total_restocked,COUNT(*) transaction_count,
      MIN(transaction_date) first_transaction,MAX(transaction_date) last_transaction FROM `TRANSACTION`
      GROUP BY product_id,warehouse_id""")

@app.get("/api/consumption/daily")
def daily_consumption(product_id: str|None=None, warehouse_id: str|None=None, start: date|None=None, end: date|None=None):
    return rows("""WITH RECURSIVE calendar AS (
      SELECT COALESCE(:start, (SELECT MIN(DATE(transaction_date)) FROM `TRANSACTION` WHERE transaction_type='SALE')) d
      UNION ALL SELECT d+INTERVAL 1 DAY FROM calendar WHERE d < COALESCE(:end,CURRENT_DATE)
      ), pairs AS (SELECT DISTINCT product_id,warehouse_id FROM INVENTORY), dense AS (
      SELECT calendar.d sale_date,p.product_id,p.warehouse_id,COALESCE(v.units_sold,0) units_sold
      FROM calendar CROSS JOIN pairs p LEFT JOIN v_daily_sales v ON v.sale_date=calendar.d AND v.product_id=p.product_id AND v.warehouse_id=p.warehouse_id
      WHERE (:product_id IS NULL OR p.product_id=:product_id) AND (:warehouse_id IS NULL OR p.warehouse_id=:warehouse_id)
      ), moving AS (SELECT *,AVG(units_sold) OVER(PARTITION BY product_id,warehouse_id ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) moving_avg FROM dense)
      SELECT * FROM moving ORDER BY sale_date,product_id,warehouse_id""", {"start":start,"end":end,"product_id":product_id,"warehouse_id":warehouse_id})

@app.get("/api/analytics/weekly")
def weekly():
    return rows("""WITH weekly AS (SELECT product_id,warehouse_id,YEARWEEK(sale_date,3) week_id,SUM(units_sold) units
      FROM v_daily_sales GROUP BY product_id,warehouse_id,YEARWEEK(sale_date,3)), lagged AS (
      SELECT *,LAG(units) OVER(PARTITION BY product_id,warehouse_id ORDER BY week_id) previous_units FROM weekly)
      SELECT *,ROUND((units-previous_units)*100/NULLIF(previous_units,0),2) wow_change_pct FROM lagged ORDER BY week_id DESC""")

@app.get("/api/analytics/trends")
def trend_analysis():
    return rows("""WITH numbered AS (SELECT product_id,warehouse_id,sale_date,units_sold,
      ROW_NUMBER() OVER(PARTITION BY product_id,warehouse_id ORDER BY sale_date) x FROM v_daily_sales), agg AS (
      SELECT product_id,warehouse_id,COUNT(*) observations,AVG(units_sold) avg_daily_usage,
      (COUNT(*)*SUM(x*units_sold)-SUM(x)*SUM(units_sold))/NULLIF(COUNT(*)*SUM(x*x)-SUM(x)*SUM(x),0) trend_slope
      FROM numbered GROUP BY product_id,warehouse_id)
      SELECT *,CASE WHEN trend_slope>0.20 THEN 'RISING' WHEN trend_slope< -0.10 THEN 'FALLING' ELSE 'STABLE' END trend_direction FROM agg""")

@app.get("/api/dashboard")
def dashboard():
    counts=rows("""SELECT (SELECT COUNT(*) FROM PRODUCT) total_products,(SELECT COUNT(*) FROM SUPPLIER) total_suppliers,
      (SELECT COUNT(*) FROM WAREHOUSE) total_warehouses,(SELECT COALESCE(SUM(quantity_on_hand),0) FROM INVENTORY) total_units,
      (SELECT COUNT(*) FROM INVENTORY WHERE quantity_on_hand<=reorder_point) static_reorders,
      (SELECT ROUND(AVG(percentage_used),1) FROM (SELECT w.warehouse_id,COALESCE(SUM(i.quantity_on_hand),0)*100/w.capacity percentage_used FROM WAREHOUSE w LEFT JOIN INVENTORY i USING(warehouse_id) GROUP BY w.warehouse_id,w.capacity) x) avg_utilisation""")[0]
    counts["daily_consumption"]=rows("SELECT * FROM v_daily_sales ORDER BY sale_date")
    counts["warehouses"]=warehouses()
    counts["trends"]=trend_analysis()
    counts["alerts"]=smart_alerts()
    counts["products_requiring_reorder"]=sum(1 for alert in counts["alerts"] if alert["urgency"] in ("OVERDUE", "ORDER NOW", "ORDER SOON"))
    counts["overdue_reorders"]=sum(1 for alert in counts["alerts"] if alert["urgency"] == "OVERDUE")
    counts["estimated_purchasing_cost"]=sum(float(alert["estimated_cost"] or 0) for alert in counts["alerts"])
    return counts

@app.post("/api/predictions/generate")
def generate_predictions(analysis_date: date|None=Query(default=None)):
    with SessionLocal.begin() as db:
        target=analysis_date or date.today()
        db.execute(text("""INSERT IGNORE INTO CONSUMPTION_TREND(product_id,warehouse_id,period_start,moving_avg,trend_slope,avg_daily_usage)
          WITH RECURSIVE cal AS (SELECT :target - INTERVAL 20 DAY d UNION ALL SELECT d+INTERVAL 1 DAY FROM cal WHERE d<:target-INTERVAL 1 DAY),
          pairs AS (SELECT product_id,warehouse_id FROM INVENTORY), daily AS (
          SELECT p.product_id,p.warehouse_id,cal.d,COALESCE(v.units_sold,0) units FROM pairs p CROSS JOIN cal
          LEFT JOIN v_daily_sales v ON v.product_id=p.product_id AND v.warehouse_id=p.warehouse_id AND v.sale_date=cal.d),
          num AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY product_id,warehouse_id ORDER BY d) x,
          AVG(units) OVER(PARTITION BY product_id,warehouse_id ORDER BY d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) ma FROM daily),
          agg AS (SELECT product_id,warehouse_id,MAX(d) period_start,MAX(ma) moving_avg,AVG(units) avg_usage,COUNT(*) n,
          SUM(x*units) sxy,SUM(x) sx,SUM(units) sy,SUM(x*x) sx2 FROM num GROUP BY product_id,warehouse_id)
          SELECT product_id,warehouse_id,period_start,moving_avg,
          COALESCE((n*sxy-sx*sy)/NULLIF(n*sx2-sx*sx,0),0),avg_usage FROM agg"""), {"target":target})
        db.execute(text("""INSERT IGNORE INTO REORDER_PREDICTION(trend_id,generated_at,predicted_stockout_date,recommended_order_qty,reorder_date)
          WITH ranked AS (SELECT ps.product_id,ps.supplier_id,ps.supply_price,ps.lead_time_days,
          ROW_NUMBER() OVER(PARTITION BY ps.product_id ORDER BY ps.lead_time_days,ps.supply_price) rn FROM PRODUCT_SUPPLIER ps),
          calc AS (SELECT t.trend_id,t.product_id,t.warehouse_id,t.moving_avg,t.trend_slope,i.quantity_on_hand,i.safety_stock,
          COALESCE(r.lead_time_days,0) lead_days FROM CONSUMPTION_TREND t JOIN INVENTORY i USING(product_id,warehouse_id)
          LEFT JOIN ranked r ON r.product_id=t.product_id AND r.rn=1 WHERE t.period_start=:target-INTERVAL 1 DAY)
          SELECT trend_id,NOW(),CASE WHEN moving_avg>0 THEN :target+INTERVAL FLOOR(quantity_on_hand/moving_avg) DAY ELSE NULL END,
          GREATEST(0,CEIL((moving_avg+GREATEST(trend_slope,0)*lead_days)*(lead_days+14)+safety_stock-quantity_on_hand)),
          CASE WHEN moving_avg>0 THEN :target+INTERVAL FLOOR((quantity_on_hand-safety_stock)/moving_avg) DAY-INTERVAL lead_days DAY ELSE NULL END
          FROM calc"""), {"target":target})
    return {"status":"generated","analysis_date":target.isoformat()}

@app.get("/api/alerts")
def smart_alerts(warehouse_id: str|None=None, product_id: str|None=None, urgency: str|None=None, supplier_id: str|None=None, start: date|None=None, end: date|None=None):
    return rows("""WITH suppliers AS (SELECT ps.*,ROW_NUMBER() OVER(PARTITION BY product_id ORDER BY lead_time_days,supply_price) rn FROM PRODUCT_SUPPLIER ps),
      snapshots AS (SELECT t.*,rp.reorder_date,rp.recommended_order_qty,rp.predicted_stockout_date,
      ROW_NUMBER() OVER(PARTITION BY t.product_id,t.warehouse_id ORDER BY t.period_start DESC,t.trend_id DESC) latest
      FROM CONSUMPTION_TREND t JOIN REORDER_PREDICTION rp USING(trend_id)), report AS (
      SELECT w.warehouse_name,p.product_id,p.product_name,i.quantity_on_hand,i.reorder_point,rp.reorder_date,
      DATEDIFF(rp.reorder_date,CURRENT_DATE) days_remaining,
      CASE WHEN rp.reorder_date<CURRENT_DATE THEN 'OVERDUE' WHEN rp.reorder_date<=CURRENT_DATE+INTERVAL 3 DAY THEN 'ORDER NOW'
      WHEN rp.reorder_date<=CURRENT_DATE+INTERVAL 7 DAY THEN 'ORDER SOON' ELSE 'OK' END urgency,
      s.supplier_name,s.supplier_id,rp.recommended_order_qty,s.supply_price,
      rp.recommended_order_qty*s.supply_price estimated_cost,rp.predicted_stockout_date
      FROM snapshots rp JOIN INVENTORY i USING(product_id,warehouse_id)
      JOIN PRODUCT p USING(product_id) JOIN WAREHOUSE w USING(warehouse_id) LEFT JOIN suppliers s ON s.product_id=p.product_id AND s.rn=1
      WHERE rp.latest=1 AND (:warehouse_id IS NULL OR i.warehouse_id=:warehouse_id) AND (:product_id IS NULL OR p.product_id=:product_id))
      SELECT * FROM report WHERE (:urgency IS NULL OR urgency=:urgency) AND (:supplier_id IS NULL OR supplier_id=:supplier_id)
      AND (:start IS NULL OR reorder_date>=:start) AND (:end IS NULL OR reorder_date<=:end)
      ORDER BY FIELD(urgency,'OVERDUE','ORDER NOW','ORDER SOON','OK'),reorder_date""",
      {"warehouse_id":warehouse_id,"product_id":product_id,"urgency":urgency,"supplier_id":supplier_id,"start":start,"end":end})

@app.get("/api/comparison")
def comparison():
    return rows("""WITH snapshots AS (SELECT t.product_id,t.warehouse_id,rp.reorder_date,
      ROW_NUMBER() OVER(PARTITION BY t.product_id,t.warehouse_id ORDER BY t.period_start DESC,t.trend_id DESC) rn
      FROM CONSUMPTION_TREND t JOIN REORDER_PREDICTION rp USING(trend_id))
      SELECT i.product_id,p.product_name,i.warehouse_id,w.warehouse_name,i.quantity_on_hand,i.reorder_point,
      CASE WHEN i.quantity_on_hand<=i.reorder_point THEN 'REORDER' ELSE 'OK' END static_status,rp.reorder_date,
      CASE WHEN rp.reorder_date<=CURRENT_DATE+INTERVAL 3 DAY THEN 'REORDER' ELSE 'OK' END predictive_status
      FROM snapshots rp JOIN INVENTORY i USING(product_id,warehouse_id)
      JOIN PRODUCT p USING(product_id) JOIN WAREHOUSE w USING(warehouse_id)
      WHERE rp.rn=1 AND i.quantity_on_hand>i.reorder_point AND rp.reorder_date<=CURRENT_DATE+INTERVAL 3 DAY ORDER BY rp.reorder_date""")
