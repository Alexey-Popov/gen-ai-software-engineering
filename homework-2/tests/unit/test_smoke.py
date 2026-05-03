def test_app_boots(client):
    """Verify the FastAPI app starts and the /tickets route is registered and live."""
    response = client.get("/tickets")
    assert response.status_code == 200
