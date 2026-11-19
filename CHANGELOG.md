# Changelog

## 0.12.0 (2026-11-19)
Gyro Public API 2.43.0.
- `get_account_activity`: sign-ins and account events of the client area (API 2.42.0 `GET /activity`, needs `account_read`; sub-account keys are refused).
- Saved cards and automatic balance top-up (API 2.41.0): `list_saved_cards`, `get_auto_topup` (read), `update_saved_card` (confirm), `set_auto_topup` (confirm; authorises card charges, sends `consent`), `delete_saved_card` (destructive, also deleted at the bank). Card numbers never pass through the server; new cards are added in the browser with 3-D Secure.
- S3 bucket fill alerts (API 2.43.0): `list_bucket_alerts`, `set_bucket_alert` (confirm; percent of the package or GB), `delete_bucket_alert` (confirm).

## 0.11.0 (2026-11-15)
- Snapshot schedule tools (API 2.40.0). Earlier versions: see the git history.
