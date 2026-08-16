# Data handling, consent, and cleanup / 数据处理、同意与清理

This document describes the repository's reference behavior. A deployment owner remains responsible for a lawful privacy notice, processor terms, data-subject requests, incident handling, and any jurisdiction- or school-specific review.

## Reference data lifecycle

| Data | Purpose | Reference lifecycle |
| --- | --- | --- |
| Video-analysis task and unbound uploaded video | Produce a bounded teaching timeline | The task receives a seven-day `expiresAt` value. New tasks are cleanup-eligible until atomically bound to an order. |
| Order-bound video-analysis task | Preserve the server result used by a diagnosis order | Marked `order-bound` and excluded from automatic expiry cleanup; the deployment owner must define order/account deletion rules. |
| Rate-limit record | Enforce caller-scoped abuse limits | Receives expiry metadata and is deleted in bounded batches by the cleanup function when enabled. |
| Lesson-plan and voice attachment | Support an order or conversation | Uses a server-issued request path. No universal automatic deletion period is imposed because the business record may still be active. |
| Message, conversation, profile, and order | Provide the mentoring workflow | Retained until the deployment's documented account/order/conversation deletion process applies. |
| Mentor application | Support independent approval | Stores a bounded qualification summary, not identity-document images. Production verification material must use a separately reviewed private channel. |

The absence of a universal retention duration is deliberate: this public reference cannot decide a deployer's legal basis, contractual record period, school policy, or dispute window. A real deployment must publish those values before collecting real user data.

## Video-processing acknowledgement

The diagnosis page requires an explicit acknowledgement before opening the media picker. It states that the uploader must have the required permission from recorded people or guardians and that a temporary video address is sent to the external analysis service configured by the deployment owner.

`analyzeVideo` also requires the current `consentVersion` during task preparation and stores that version with a server timestamp. This records the in-product acknowledgement; it does not prove that every recorded person legally consented. Deployment owners must provide their actual processor identity, terms, retention, withdrawal, and contact details.

Completed diagnosis orders submit an analysis task ID, not a client-authored timeline. `addOrder` rechecks task ownership, completion, and file identity, copies the server-stored timeline into the order, and atomically prevents one analysis task from creating multiple orders.

## Cleanup function

`cleanupExpiredData` is a daily timer function based on the CloudBase timer configuration format. It uses the server SDK's batch file-deletion operation. See the official [timer configuration](https://docs.cloudbase.net/cli-v1/functions/configs) and [Cloud Storage API](https://docs.cloudbase.net/api-reference/server/node-sdk/storage).

Safety behavior:

- deletion is disabled unless `DATA_CLEANUP_ENABLED=true`;
- deployment permissions must disable Mini Program/client invocation; `event.Type` alone is not trusted authentication;
- `{ "dryRun": true }` returns bounded candidate counts without mutation;
- each invocation processes 20 records by default and never more than 50;
- an expired task is transactionally claimed before its file is deleted;
- a task already bound to an order cannot be claimed;
- a storage failure releases the claim for retry;
- an expired historical task without a verified `fileID` moves to `manual-review` instead of being blindly deleted;
- output and logs contain counts and error codes, not file IDs, `OPENID` values, temporary URLs, or user content.

Recommended enablement sequence:

1. Deploy the function with cleanup disabled.
2. Run a dry run from the Cloud Function console and record only sanitized counts.
3. Review legacy and `manual-review` tasks, backups, order retention, and recovery requirements.
4. Set `DATA_CLEANUP_ENABLED=true` only in the isolated environment first.
5. Upload the timer trigger configuration and observe at least one scheduled run.
6. Repeat the process for production only after a documented approval and rollback decision.

The reference cleanup covers new cleanup-eligible AI tasks and expired rate counters. It does not discover an upload that never reached `analyzeVideo.start`, and it does not automatically delete active order attachments, messages, conversations, profiles, or orders.

## 中文摘要

诊课室在选择视频前要求用户明确确认处理说明，服务端会保存同意版本和服务端时间。这只能证明用户完成了产品内确认，不能代替部署方的隐私告知、监护人授权或法律审查。

新建 AI 任务默认标记 7 天到期。定时清理函数默认禁用；启用后只会删除已到期且未绑定订单的可确认 AI 视频/任务和过期限流记录。缺少文件 ID 的历史任务进入人工复核，已绑定订单的任务不会被自动删除。
