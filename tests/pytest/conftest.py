import pytest
from unittest.mock import Mock


@pytest.fixture
def mock_hotel_repository():
    repository = Mock()
    repository.find_available.return_value = [
        {
            "id": "hotel_1",
            "title": "Sigmora Demo Stay",
            "city": "Goa",
            "price_per_night": 4200,
        }
    ]
    return repository


@pytest.fixture
def mock_payment_gateway():
    gateway = Mock()
    gateway.create_order.return_value = {
        "id": "order_demo_123",
        "status": "created",
    }
    return gateway
