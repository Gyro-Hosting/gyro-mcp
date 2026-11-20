# Changelog

## 0.14.0 (2026-11-20)
Gyro Public API 2.44.0.
- Backup Space (Gyro Yedekleme Alanı: SFTP backup storage with a hard quota, bound to one server of the account, tr-ist-1):
  `list_backup_space_plans`, `list_backup_spaces`, `get_backup_space`, `get_backup_space_credentials` (read; the SFTP password is masked
  unless `reveal_secrets: true`); `create_backup_space` (spends money: price quote first, the confirmed order sends an Idempotency-Key);
  `reset_backup_space_password`, `attach_backup_space_server` (confirm); `delete_backup_space` (destructive; `immediate: true` deletes
  every file in the space permanently).

## 0.13.0 (2026-11-20)
Gyro Public API 2.43.1.
- Protected Storage (versioning + object lock) tools: `get_object_lock_summary`, `scan_object_locks`, `list_object_versions`,
  `get_bucket_object_lock`, `get_object_retention`, `get_object_legal_hold`, `get_noncurrent_expiration` (read);
  `restore_object_version`, `undelete_object`, `set_bucket_default_retention`, `set_object_retention`, `set_object_legal_hold`,
  `set_noncurrent_expiration` (confirm); `delete_object_version` (destructive, permanent). COMPLIANCE retention needs
  `confirm: true` and `acknowledge: "COMPLIANCE"` (nobody can shorten or remove it). The legal hold tool says that any key with write
  access can remove a legal hold (standard S3), so ransomware protection should rely on COMPLIANCE.

## 0.12.0 (2026-11-19)
Gyro Public API 2.43.0.
- `get_account_activity`: sign-ins and account events of the client area (API 2.42.0 `GET /activity`, needs `account_read`; sub-account keys are refused).
- Saved cards and automatic balance top-up (API 2.41.0): `list_saved_cards`, `get_auto_topup` (read), `update_saved_card` (confirm), `set_auto_topup` (confirm; authorises card charges, sends `consent`), `delete_saved_card` (destructive, also deleted at the bank). Card numbers never pass through the server; new cards are added in the browser with 3-D Secure.
- S3 bucket fill alerts (API 2.43.0): `list_bucket_alerts`, `set_bucket_alert` (confirm; percent of the package or GB), `delete_bucket_alert` (confirm).

## 0.11.0 (2026-11-15)
- Snapshot schedule tools (API 2.40.0). Earlier versions: see the git history.
