# Testing and evidence / 测试与证据

This project separates evidence into three levels. A passing lower level is useful, but it must not be described as proof that a higher level has passed.

本项目将验证证据分为三个层级。较低层级通过具有实际价值，但不能据此声称更高层级已经完成。

## Evidence levels / 证据层级

| Level | Current evidence | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| Repository validation | `scripts/validate-project.js` in CI | Required files exist, JSON and JavaScript parse, Cloud Function packages are complete, obvious deployment identifiers and credentials are absent | Business correctness or CloudBase runtime behavior |
| Handler behavior | Node.js tests with deterministic in-memory adapters | The same handlers exported by selected Cloud Functions enforce approval, ownership, atomic state checks, and expected success/error outcomes | WeChat identity injection, SDK query semantics, deployed indexes, permissions, or security rules |
| Isolated deployment | Manual matrix in a fresh CloudBase environment | Real Developer Tools, Cloud Functions, database, storage, identity context, rules, and cross-account flows work together | Behavior in a different environment or future commit |

## Maintainer deployment checkpoint / 维护者部署检查点

On 2026-08-14, a maintainer used an authenticated WeChat Developer Tools session to:

- query the selected CloudBase environment and its 14 pre-existing Cloud Functions;
- download an off-repository backup of those functions and verify the source and configuration checksums;
- deploy the four additive functions `updateProfile`, `submitMentorApplication`, `completeOrder`, and `getProtectedFileURL` with cloud-side dependency installation;
- query all four deployed functions as `Active` and confirm that the environment then contained 18 functions;
- leave the nine pre-existing same-name functions unchanged and retain five environment-specific legacy functions.

2026-08-14，维护者通过已登录的微信开发者工具会话完成了环境与云函数清单查询、14 个既有云函数的仓库外备份，以及 4 个新增云函数的部署。部署后查询显示 4 个新增函数均为 `Active`，环境内共有 18 个函数；9 个同名既有函数未被覆盖，5 个环境专用历史函数也未删除。

This checkpoint establishes successful backup, additive deployment, and post-deployment status queries. It does **not** establish successful business calls, Cloud Database compatibility, security-rule enforcement, cross-account authorization, or a reproducible fresh-environment deployment. Those claims remain pending the isolated deployment matrix.

该检查点只证明备份、新增部署和部署后状态查询成功，并不证明业务调用、云数据库兼容性、安全规则、跨账号授权或全新环境复现已经通过；这些结论仍需完成隔离环境测试矩阵后才能给出。

A follow-up, read-only simulator check reached `getProtectedFileURL` and `completeOrder` through `wx.cloud.callFunction`; empty inputs resolved with the expected `code: -1` validation response and did not enter a database write path. A count-only client audit confirmed the expected historical collections except `contents`, which was absent. The same audit showed that client-side reads were still permitted, every legacy mentor record lacked an approval state, and historical user/order data required review before enforcing the new authorization model. No document identifiers, profile fields, message bodies, or file references were exported.

后续只读模拟器检查通过 `wx.cloud.callFunction` 调用了 `getProtectedFileURL` 和 `completeOrder`；空参数均返回预期的 `code: -1`，且没有进入数据库写入路径。仅计数的客户端审计确认了历史集合，但发现 `contents` 尚未创建、客户端读取仍可执行、所有历史师傅记录均缺少审核状态，并且历史用户与订单数据需要在启用新授权模型前人工复核。审计没有导出文档 ID、个人资料、消息正文或文件引用。

The original development environment and historical runtime experience provide project history, but public deployment evidence should be repeatable from the repository without private infrastructure. The isolated-deployment level therefore remains a separate recorded step.

原开发环境和历史运行经历构成项目历史，但公开部署证据应当能够只依赖仓库重新复现，而不依赖私有历史基础设施。因此，隔离环境部署验证仍需单独执行和记录。

## Run locally / 本地运行

Requirements: Node.js 18 or newer. No AppID, CloudBase environment, account credential, or provider key is required.

```bash
npm test
```

To run only the mentor-order behavior suite:

```bash
node --test tests/cloud-function-behavior.test.js
```

## Mockable handler boundary / 可模拟处理器边界

The selected Cloud Functions use three files:

```text
index.js                    wires the WeChat SDK and exports main
cloud-database-adapter.js   translates handler operations into Cloud Database calls
handler.js                  contains authorization and business decisions
```

Tests import `handler.js`, which is the same function factory used by `index.js`, and inject the deterministic order or messaging in-memory adapter under `tests/`. They do not copy the business rules into a test-only implementation.

测试直接导入 `index.js` 实际使用的 `handler.js` 工厂，并注入 `tests/` 下确定性的订单或消息内存适配器；业务规则不会在测试目录中复制一份。

Currently covered behavior:

- every Cloud Function pins the repository-wide `wx-server-sdk` baseline;
- a student or pending mentor cannot list the demand hall;
- students see only their own orders;
- only an explicitly approved mentor can claim an open order;
- an atomic claim conflict cannot create conversation memberships;
- a retry by the assigned mentor is idempotent;
- a competing mentor cannot take an assigned order;
- only the assigned approved mentor can complete an active order;
- an atomic completion conflict cannot report a false success;
- order-message content is visible only to the student owner or assigned approved mentor;
- stale, revoked, unassigned, and forged order memberships are excluded from conversation lists;
- unauthorized memberships cannot receive new order-message previews or unread-count updates;
- text and voice messages are normalized only after authorization, and read actions update only the caller's membership;
- message retries create one caller-scoped document and increment peer unread state once;
- the thirty-first new message per caller per minute is rejected, while replay does not consume a second rate slot;
- invalid voice paths and out-of-range durations fail before the message transaction;
- voice upload paths are caller- and request-scoped, and an unrelated `chat/` object is rejected;
- an order request and simulated balance deduction commit together in the behavior model;
- retrying the same caller-scoped request returns one order without a second deduction;
- the eleventh new order per caller per hour is rejected, while replay does not consume a second rate slot;
- lesson-plan paths are caller- and request-scoped, unrelated cloud objects are rejected, and the stored byte size must match the bounded client declaration;
- replaying a confirmed lesson-plan order does not repeat the remote object check or create a second order;
- insufficient balance and simulated order-write failure leave both order and balance state unchanged;
- ambiguous amounts, malformed request IDs, unknown detail fields, and oversized detail values fail closed or are bounded;
- video-analysis tasks require a server-issued upload path and remain owner-bound across prepare, start, and status actions;
- replaying a video request consumes one rate-limit slot, while a fourth new task in one hour is rejected;
- arbitrary cloud file IDs, another caller's task ID, stale processing state, and provider failure fail closed;
- asynchronous provider submission happens once, pending/transient result checks remain retryable, and completion is persisted through status polling;
- provider output is bounded to 100 timeline entries, with bounded labels and descriptions.

## Adding coverage / 增加覆盖

When refactoring another Cloud Function:

1. keep SDK initialization and `OPENID` retrieval in `index.js`;
2. expose only purpose-specific operations from the database adapter;
3. keep authorization and state decisions in a dependency-injected handler;
4. add negative, successful, retry, ownership, and concurrent-state cases where relevant;
5. avoid reproducing CloudBase internals in the in-memory adapter;
6. retain an isolated-environment test for SDK and rule behavior.

The in-memory adapter is test infrastructure, not a CloudBase emulator. If a test depends on SDK query ordering, database indexes, security-rule evaluation, file permissions, or platform identity behavior, record it in the deployment matrix instead of inventing local behavior.
