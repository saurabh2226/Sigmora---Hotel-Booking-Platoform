"""
Conceptual pytest examples for teams that want to document Python-style
fixtures and mocking alongside the Node.js implementation.
"""


def search_hotels(repository, city):
    return repository.find_available(city=city)


def create_payment_order(gateway, amount):
    response = gateway.create_order(amount=amount)
    return response["status"]


def test_search_hotels_uses_fixture(mock_hotel_repository):
    hotels = search_hotels(mock_hotel_repository, "Goa")

    assert len(hotels) == 1
    assert hotels[0]["city"] == "Goa"
    mock_hotel_repository.find_available.assert_called_once_with(city="Goa")


def test_payment_gateway_is_mocked(mock_payment_gateway):
    status = create_payment_order(mock_payment_gateway, 1999)

    assert status == "created"
    mock_payment_gateway.create_order.assert_called_once_with(amount=1999)
