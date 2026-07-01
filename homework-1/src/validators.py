import re
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List

ACCOUNT_PATTERN = re.compile(r"^ACC-[A-Za-z0-9]{5}$")

VALID_TYPES = {"deposit", "withdrawal", "transfer"}

# A representative subset of active ISO 4217 currency codes, sufficient for demo purposes.
VALID_CURRENCIES = {
    "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "NZD",
    "SEK", "NOK", "DKK", "SGD", "HKD", "MXN", "BRL", "ZAR", "KRW", "PLN",
}


def _validate_account(field: str, value: Any, errors: List[Dict[str, str]]) -> None:
    if not isinstance(value, str) or not value:
        errors.append({"field": field, "message": f"{field} is required and must be a string"})
    elif not ACCOUNT_PATTERN.match(value):
        errors.append({"field": field, "message": "Account number must match format ACC-XXXXX"})


def _validate_amount(value: Any, errors: List[Dict[str, str]]) -> None:
    if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
        errors.append({"field": "amount", "message": "Amount must be a positive number"})
        return
    if value <= 0:
        errors.append({"field": "amount", "message": "Amount must be a positive number"})
        return
    try:
        decimal_value = Decimal(str(value))
    except InvalidOperation:
        errors.append({"field": "amount", "message": "Amount must be a positive number"})
        return
    exponent = decimal_value.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        errors.append({"field": "amount", "message": "Amount must have at most 2 decimal places"})


def _validate_currency(value: Any, errors: List[Dict[str, str]]) -> None:
    if not isinstance(value, str) or value.upper() not in VALID_CURRENCIES:
        errors.append({"field": "currency", "message": "Invalid currency code"})


def _validate_type(value: Any, errors: List[Dict[str, str]]) -> None:
    if not isinstance(value, str) or value not in VALID_TYPES:
        errors.append({"field": "type", "message": "Type must be one of: deposit, withdrawal, transfer"})


def validate_transaction_payload(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    """Validate a raw transaction creation payload, returning a list of field errors."""
    errors: List[Dict[str, str]] = []

    _validate_account("fromAccount", payload.get("fromAccount"), errors)
    _validate_account("toAccount", payload.get("toAccount"), errors)
    _validate_amount(payload.get("amount"), errors)
    _validate_currency(payload.get("currency"), errors)
    _validate_type(payload.get("type"), errors)

    return errors
