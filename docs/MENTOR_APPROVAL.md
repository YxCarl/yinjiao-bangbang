# Mentor approval / 导师审批

This document defines the security boundary for mentor access. The Mini Program client is untrusted: selecting the mentor entry point, changing a request payload, or editing local storage must never grant mentor privileges.

本文定义导师权限的安全边界。小程序客户端不可信：选择导师入口、修改请求参数或篡改本地存储，都不能直接获得导师权限。

## Security invariant / 安全不变量

A server-side user record is an authorized mentor only when both conditions are true:

```text
role = mentor AND mentorStatus = approved
```

Every mentor-sensitive Cloud Function checks both fields. Missing or unknown approval states fail closed.

所有导师敏感云函数必须同时校验这两个字段；状态缺失或未知时默认拒绝。

## States / 状态

| `mentorStatus` | Effective permission | Meaning |
| --- | --- | --- |
| `not_requested` | Student | No application has been submitted. |
| `pending` | Student | An application exists and awaits independent review. |
| `approved` | Mentor only when `role` is also `mentor` | A trusted operator recorded approval. |
| `rejected` | Student | The application was rejected or needs more information. |

Allowed transitions:

```text
not_requested -> pending       applicant submits
rejected      -> pending       applicant resubmits
pending       -> approved      trusted operator only
pending       -> rejected      trusted operator only
approved      -> rejected      trusted operator revokes access
```

The public application function can write only `role: student` and `mentorStatus: pending`. This repository intentionally exposes no client-callable approval function.

## Application flow / 申请流程

1. `loginOrFetch` creates new users as students, regardless of the client-selected entry point.
2. A mentor applicant opens `pages/teacher-cert` and submits bounded profile information.
3. `submitMentorApplication` derives `OPENID` from the WeChat runtime and records a `pending` application.
4. Until independent approval, the account continues to use student permissions.
5. Mentor pages and server operations require an explicit approved-mentor record.

The reference flow stores a short qualification summary, not identity-document images. A real deployment must define a lawful verification channel, privacy notice, retention period, reviewer access policy, and deletion procedure before collecting sensitive credentials.

## Trusted review procedure / 可信审核流程

The current open-source reference uses a deployment-owner operation in the CloudBase console. This is deliberately separate from the Mini Program. Before approval, the operator must verify the submitted claims through an appropriate off-client process.

For an approval, edit the same `users` document in one reviewed operation:

```json
{
  "role": "mentor",
  "mentorStatus": "approved",
  "mentorReview": {
    "outcome": "approved",
    "reviewedAt": "deployment-owner timestamp",
    "reviewerReference": "non-secret internal review reference"
  }
}
```

For rejection or revocation, set `role` to `student`, set `mentorStatus` to `rejected`, and record a non-sensitive review reference. Do not put identity-document numbers, private reviewer notes, or credentials in public issues or logs.

A future administrative review service must authenticate an allowlisted reviewer, enforce state transitions server-side, and write an immutable audit event. It must not replace the current separation with a public “approve me” endpoint.

## Legacy records / 历史记录

An existing record with `role: mentor` but without `mentorStatus: approved` is treated as a student by `loginOrFetch` and is rejected by mentor-sensitive Cloud Functions. Review each legacy mentor individually before adding the explicit approval state.

Do not bulk-approve legacy records merely because they previously contained `role: mentor`. If approval cannot be re-established, migrate the record to `role: student` with `mentorStatus: pending` or `rejected`.

## Deployment and verification / 部署与验证

This feature depends on deny-client-write database rules. Deploy it together with the rule baseline described in [Security rules](SECURITY_RULES.md).

In a fresh isolated environment:

1. Deploy `loginOrFetch`, `submitMentorApplication`, and every mentor-sensitive function.
2. Apply the deny-client-access database rules.
3. Log in with a new account through the mentor entry point; confirm the stored role remains `student`.
4. Submit an application; confirm the status becomes `pending` and mentor order listing returns code `-3`.
5. Change only local storage or function payloads to `mentor`; confirm access is still denied.
6. Approve the record through the trusted console procedure; confirm the mentor workspace and assigned-order conversation succeed.
7. Revoke approval; confirm order, conversation, and protected-file access is denied immediately.
8. Record the environment type, date, commit, and redacted results in the implementing pull request.

Run `npm test` before the runtime checks. Automated tests cover secure profile defaults, application validation, and the presence of explicit approval guards; they do not claim that CloudBase deployment behavior has been exercised.
