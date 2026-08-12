# CloudBase security rules / 云开发安全规则

This repository uses a server-authorized data model: Mini Program pages call Cloud Functions for database access, while direct client database access is denied. Client uploads remain owner-bound, and shared downloads require a short-lived URL issued after server-side authorization.

本项目采用服务端鉴权模型：小程序页面通过云函数访问数据库，客户端不能直接访问数据库；客户端上传的文件归上传者所有，跨用户下载必须由云函数验证订单或会话权限后签发临时地址。

The examples target CloudBase classic document database and storage security rules. PostgreSQL environments require RLS policies instead.

## Files / 配置文件

- `security/database-rules.json` maps every required collection to the same deny-client-access rule.
- `security/storage-rules.json` allows direct reads and writes only when the caller owns the file.
- `getProtectedFileURL` authorizes order attachments, voice messages, and published content before returning a temporary URL.

CloudBase applies database rules per collection. Copy the object below into each collection listed in `security/database-rules.json`:

```json
{
  "read": false,
  "write": false
}
```

Apply `security/storage-rules.json` as the custom Cloud Storage rule:

```json
{
  "read": "resource.openid == auth.openid || resource.openid == auth.uid",
  "write": "resource.openid == auth.openid || resource.openid == auth.uid"
}
```

These rules affect client SDK requests. Cloud Functions and console administrators retain server-side access, so every Cloud Function must continue to authorize callers using the platform-provided `OPENID`.

## Safe rollout order / 安全部署顺序

1. Deploy all Cloud Functions, including `getProtectedFileURL`.
2. Upload the updated Mini Program client and confirm it calls `getProtectedFileURL` for downloads.
3. In CloudBase Console, open each database collection, switch to custom security rules, and apply the deny rule.
4. In Cloud Storage permission settings, apply `security/storage-rules.json`.
5. Wait for the rules to take effect, then run the positive and negative checks below with isolated test accounts.
6. Roll back the Mini Program version before relaxing the rules if a required workflow fails. Do not temporarily make a production bucket public.

Applying the storage rule before deploying the protected-file function will prevent mentors from opening student attachments and participants from playing each other's voice messages.

## Required manual checks / 必须执行的人工检查

Use two student accounts, two mentor accounts, and sanitized test files. Do not use production data.

| Check | Expected result |
| --- | --- |
| A client attempts a direct database query | Denied for all six collections |
| A student uploads an order document or video | Allowed; the uploader owns the file |
| The same student opens their order attachment | Allowed through `getProtectedFileURL` |
| The assigned mentor opens that attachment | Allowed through order authorization |
| A different mentor requests the attachment | Denied |
| A conversation member plays a stored voice message | Allowed |
| A non-member supplies the same conversation and file IDs | Denied |
| A user opens a file referenced by a `contents` record | Allowed through content lookup |
| A user supplies an arbitrary cloud file ID | Denied because no authorized record matches |
| A user attempts to modify another profile, order, or message directly | Denied |

Record the test date, WeChat Developer Tools version, cloud environment type, sanitized result, and related commit. Never record AppIDs, environment IDs, `OPENID` values, temporary URLs, or credentials.

## Automated checks / 自动检查

Run:

```bash
npm test
```

The automated suite verifies that:

- all six collections are present and deny direct client reads and writes;
- storage rules never grant public access;
- Mini Program pages do not call direct Cloud Storage download or temporary-URL APIs;
- order and conversation authorization helpers reject unrelated users and arbitrary URLs.

The local tests validate repository policy and authorization logic; they are not a CloudBase rule emulator. A release is not considered verified until the manual checks pass in an isolated CloudBase environment.

## References

- [CloudBase database security rules](https://docs.cloudbase.net/database/security-rules/)
- [CloudBase storage security rules](https://docs.cloudbase.net/storage/security-rules)
