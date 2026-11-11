from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_connects_to_mysql():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_seed_catalogue_and_six_inventory_pairs():
    products = client.get("/api/products")
    inventory = client.get("/api/inventory")
    assert products.status_code == 200
    assert {row["product_id"] for row in products.json()} == {"P101", "P102", "P103", "P104"}
    assert inventory.status_code == 200
    assert len(inventory.json()) >= 6


def test_sale_cannot_make_inventory_negative():
    response = client.post("/api/transactions", json={
        "product_id": "P101", "warehouse_id": "W1", "transaction_type": "SALE", "quantity": 999999
    })
    assert response.status_code == 409


def test_zero_quantity_movement_is_rejected():
    response = client.post("/api/transactions", json={
        "product_id": "P101", "warehouse_id": "W1", "transaction_type": "SALE", "quantity": 0
    })
    assert response.status_code == 422
