# Changelog

## 0.17.0 (2026-11-26)
Gyro Public API 2.47.0: new servers from your own templates, also on Turkey VDS plans.
- `list_templates`: custom templates of the account (`image` = `custom:<id>`, `min_disk_gb`, `size_gb`, `status`).
- `create_server_from_template` (spends money, quote first): a server installed from one of your templates. Gyro Cloud Istanbul plans are
  hourly prepaid; Turkey VDS plans (e.g. `gvds-2`) are billed with the plan's normal invoice for `cycle` (monthly default; semiannually,
  annually, biennially), the first invoice paid from the balance at order time (no order if the balance is not enough). `region` resolves
  `plan` (default tr-ist-1). The dry-run quote of a Turkey VDS plan returns `cycle`, `billing: "invoice"`, `total` and `tax`.
- A refused period (`422 cycle_invalid`) comes with a plain-language `hint` listing the periods the plan offers. 127 tools.

## 0.16.1 (2026-11-24)
Gyro Public API 2.46.1: Protected Storage lock limit and long billing cycles.
- `create_storage`: `cycle` also accepts `biennially` (2 years) and `triennially` (3 years) for protected plans (2x / 3x the yearly price);
  new optional `object_lock_buckets` (protected plans, object lock bucket rights).
- An object lock may not end after the service end (renewal) date. `set_bucket_default_retention` / `set_object_retention` say so in their
  description; a refusal (`422 retention_exceeds_service_end`) now comes with a plain-language `hint` (service end date, the maximum days
  possible now, renew or move to a longer cycle). `get_object_lock_summary` explains `service_end` and `max_retention_days`.

## 0.16.0 (2026-11-24)
Gyro Public API 2.46.0: account context.
- `list_accounts`: your own account and every account whose owner added you as a panel user (Sub-Accounts), with your permissions there.
- Every account tool takes an optional `account_id` (sent as `X-Account-Id` for that call only; `"self"` = own account).
- `use_account`: session default for every account tool (stdio). Defaults: `GYRO_ACCOUNT` (stdio), the `X-Account-Id` header of the
  remote request (HTTP, stateless; also allowed in CORS).
- Idempotency keys get an `-a<account>` suffix in another account, so the same call in two accounts is never answered from the other one's
  stored response (the API answers `422 idempotency_key_reuse` to a reused key).
- Permissions are the panel user permissions; refusals come back as `403 account_permission_denied` / `account_owner_only`
  / `account_not_accessible`; prepaid billing tools (`get_balance` …) are own-account only (`422 account_context_unsupported`).
- In another account orders, invoice payments and domain registration / transfer are paid from that account's balance only
  (`422 balance_only`); the API activity log is owner only; without the "view passwords" permission secret fields come back `null`
  and console / password reset / rescue / rebuild style tools are refused; webmail / groupware sign-in needs "single sign-on".
- First npm release since 0.14.1: also contains 0.15.0 (reseller service tools) and 0.15.1.

## 0.15.1 (2026-11-23)

- `set_container_log_package`: the unconfirmed call reads the current log package and says in the question what the change does: a shorter retention deletes the older logs **permanently**; a switch from free to a paid package is billed at least 6 hours (leaving earlier charges the remaining hours at once, "minimum completion"); the monthly price. The API answer carries `data_loss`, `deletes_logs_older_than_days`, `minimum_hours`, `minimum_completion_hours` and `warning` (additive fields of the same endpoint, API 2.45.0).

## 0.15.0 (2026-11-23)

- Reseller tools for your own services (API 2.45.0): `get_reseller_service`, `suspend_reseller_service`, `unsuspend_reseller_service`, `terminate_reseller_service` (writes need `confirm: true`; terminate is marked destructive). 123 tools.

## 0.14.1 (2026-11-20)
Connection resilience for calls to the Gyro API and docs (no tool changes).
- One keep-alive connection pool per process (undici Agent: 6 connections per origin, idle sockets kept 60 s), so most calls reuse an
  open TLS connection instead of a new handshake.
- IPv4 first and no happy-eyeballs (`autoSelectFamily: false`): the 250 ms per-family attempt limit no longer turns a slow handshake into `ETIMEDOUT`.
  The container image also sets `NODE_OPTIONS=--dns-result-order=ipv4first --no-network-family-autoselection`.
- A call is retried only when the connection could not be opened (TCP/TLS handshake failed or took longer than 4 s), at most 3 attempts.
  Nothing is sent before the connection is open, so this never repeats a request; failures after the request was sent are returned as before.
  The final error now says `could not connect … after 3 attempts (CODE); nothing was sent, it is safe to retry` instead of a bare `fetch failed`.
- New dependency: `undici` 6.29.1 (the same version Node 22 ships).

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
