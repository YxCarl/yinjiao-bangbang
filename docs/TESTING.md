# Testing and evidence / 测试与证据

This project separates evidence into four levels. A passing lower level is useful, but it must not be described as proof that a higher level has passed.

本项目将验证证据分为四个层级。较低层级通过具有实际价值，但不能据此声称更高层级已经完成。

## Evidence levels / 证据层级

| Level | Current evidence | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| Repository validation | `scripts/validate-project.js` in CI | Required files exist, JSON and JavaScript parse, Cloud Function packages are complete, obvious deployment identifiers and credentials are absent | Business correctness or CloudBase runtime behavior |
| Handler behavior | Node.js tests with deterministic in-memory adapters | The same handlers exported by selected Cloud Functions enforce approval, ownership, atomic state checks, and expected success/error outcomes | WeChat identity injection, SDK query semantics, deployed indexes, permissions, or security rules |
| Installed SDK contracts | Real pinned SDK, synthetic CloudBase request boundary and loopback HTTP | Entry-point initialization, query/Date serialization, result shapes, transaction callback/retry/abort handling and storage/Axios wrappers | Platform acceptance of requests, actual credentials/signatures, concurrent cloud locking, indexes, permissions or deployed rules |
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

## WeChat platform compile checkpoint / 微信平台编译检查点

On 2026-08-16, WeChat Developer Tools `2.01.2510290` compiled the working branch through its authenticated CLI and created a preview successfully. The first attempt exposed platform error `80051`: repository documentation and test assets made the source package 2075KB, above the 2MB main-package limit. After adding explicit `packOptions.ignore` entries for repository-only material, the same preview command succeeded with a 210,305-byte (205.4KB) package.

2026-08-16，微信开发者工具 `2.01.2510290` 通过已登录 CLI 完成了当前分支的真实编译与预览。首次预览暴露出平台错误 `80051`：仓库文档和测试素材使源码包达到 2075KB，超过主包 2MB 限制。在 `packOptions.ignore` 中明确排除仅用于仓库的内容后，同一预览命令成功，包体为 210,305 字节（205.4KB）。

This checkpoint proves platform parsing, compilation, packaging, AppID association through private configuration, and preview upload for the source at that checkpoint, not later changes. It does not deploy Cloud Functions, exercise Cloud Database queries, enable cleanup, validate rules, or provide the two-account authorization evidence required by the isolated-deployment level. At that checkpoint, the authenticated account exposed one historical environment with the same 18 functions recorded above, not a second fresh environment.

该检查点证明当时的源码能通过平台解析、编译、打包、私有 AppID 关联和预览上传，不代表后续改动已经通过。它不会部署云函数，也不会验证云数据库查询、定时清理、安全规则或双账号授权。当时已登录账号只列出上文记录的含 18 个函数的历史环境，尚无第二个全新环境。

## Run locally / 本地运行

### Compatibility checkpoint: 2026-10-23 / 兼容性验收进展

- Re-ran `npm test` on Node 22.14.0 / npm 10.9.2: **132 passed**, zero failed; validation passed for 27 pages, 14 Cloud Functions and 267 checked files.
- Expanded the real installed-SDK suite from 9 to **12 passing contracts**. The added cases execute the actual `addOrder`, `grabOrder` and `completeOrder` adapters through the installed SDK. They check transaction-ID propagation, debit/expiry serialization, replay without writes, abort after a simulated write error, both claim memberships, revoked approval, owner/status update predicates, and rejection of zero/multiple updated rows. Only the CloudBase transport responses are synthetic; this does **not** establish server-side rollback or concurrent isolation.
- Re-ran `npm run audit:cloud`: all 14 locks still share the reviewed tree fingerprint, with **0 findings at every severity**.
- WeChat Developer Tools **2.02.2608070**, using the local private AppID configuration and base-library setting **3.15.0**, successfully compiled and uploaded a development preview of candidate source `4d7a68c`. The package was **203,828 bytes (199.1 KB)**. The subsequent changes in this checkpoint affect only tests and documentation, which are excluded from the Mini Program package. Preview artifacts stay in ignored `outputs/`; they are not release assets and must not be committed.
- Authenticated, read-only environment discovery returned one environment containing the same 18 function names as the historical checkpoint, including legacy functions. No fresh isolated environment was available. No functions, database records, storage rules, runtime settings or cloud credentials were changed.
- The maintainer elected to defer new environment creation. Consequently, actual cloud dependency installation/runtime versions, transaction protocol acceptance, security rules and dual-account flows remain **not tested** for this candidate. The merge/release gate remains open; a passing preview is not cloud-function deployment evidence.

本轮已完成真实微信平台编译与预览，并把已安装 SDK 契约测试扩充至 12 项。现有环境仍是含历史函数的环境，未被用作写入测试。维护者暂缓创建隔离环境，因此云端兼容性与双账号验收不能标记通过，也不能仅凭上述检查合并或发布。

### Maintenance checkpoint: 2026-10-22 / 维护检查点

**SDK security follow-up (candidate branch):** `npm test` passes **132 tests**; `npm run test:sdk` passes **9 installed-SDK contracts** on local Node 22.14.0. All 14 locks validate as one tree; `npm run audit:cloud` reports **0 vulnerabilities**, including 0 high and 0 critical. CI runs both suites on Node 22/24. See [dependency rationale and merge gate](DEPENDENCIES.md) for the two explicit overrides and runtime risks. No cloud deployment or live two-account test was performed; this is not a `v0.2.0` release.

**GitHub CI confirmation for commit `570c1a58ebd60962686a7903a34458baf9aac2ff`:**

- [Validate run 39796998931](https://github.com/YxCarl/yinjiao-bangbang/actions/runs/39796998931) completed successfully. Both Node 22 and Node 24 jobs passed repository tests/checks, installed the committed SDK lock with `npm ci --ignore-scripts`, and passed the installed-SDK contracts.
- [Dependency audit run 39796999105](https://github.com/YxCarl/yinjiao-bangbang/actions/runs/39796999105) completed successfully. Its job log confirms all 14 function locks share fingerprint `3421a993380cc524832c2c714f90edde20ee11aeef99c49c525ab0b2e4b85828`, with zero findings at every severity.
- These runs validate the candidate source and dependency tree, not a CloudBase deployment. The isolated-environment merge gate remains open; no main-branch merge, cloud rollout or release is established by these checks.

The earlier checkpoint below records the pre-upgrade tree and remains historical evidence, not the current candidate's audit status:

- `npm test` on local Node 22.14.0: **131 tests passed**, zero failed; repository validation passed for 27 pages, 14 Cloud Functions and 266 checked files.
- `npm run check:locks`: all 14 function locks validated, with one shared dependency tree.
- `npm run audit:cloud`: **failed**, with 12 affected dependency entries (4 moderate, 6 high, 2 critical; inherited findings included). This is an unresolved dependency-advisory result, not a failed behavior test and not proof of application exploitation.
- Added real message-adapter regressions for changes between the authorization precheck and the commit. The new cases reproduced the old behavior before the fix and pass with transaction-time checks.
- CI is configured for Node 22 and 24 LTS. Cloud SDK/runtime compatibility, live rules, current WeChat UI and dual-account flows were not revalidated, and no cloud deployment was performed.

上述旧基线曾出现业务测试通过而依赖审计失败；本次候选的依赖审计已通过，但隔离云环境验收仍是合并与发布门槛。

### Repository checkpoint: 2026-09-28 / 仓库验证检查点

- `npm test`: **120 tests passed**, zero failed; repository validation passed for 27 pages, 14 Cloud Functions and 247 checked files.
- `npm run fixtures:demo -- --write`: generated five synthetic JSON Lines collections plus a manifest under ignored `outputs/demo-fixtures-v1/`. Counts: 5 users, 56 orders, 110 memberships, 65 messages and 1 content item; AI tasks and rate counters start empty.
- New local evidence covers transactional claim rollback/retry, history/list pagination, late-message reconciliation and private-fixture packaging exclusions.
- No cloud environment was created or changed, no private test identities were bound, and no fixture import was performed. The maintainer has not yet prepared an isolated environment with two test accounts. CloudBase transaction/query/index checks and current WeChat UI/packaging verification remain pending; `v0.2.0` is not marked released by this checkpoint.

本次 `npm test` 的 120 项测试与仓库校验全部通过，并实际生成了合成数据文件。尚未执行云端导入、双账号实测或本轮微信界面/打包验证；这些不是本地测试能够替代的证据。

### Commands / 命令

Requirements: Node.js 22 or 24 LTS. No AppID, CloudBase environment, account credential, or provider key is required for `npm test`. CI checks both runtime lines; this does not select or change the deployed Cloud Function runtime.

```bash
npm test
```

`npm run check:locks` validates every Cloud Function lock without network access. `npm run audit:cloud` separately contacts the public npm advisory service, deduplicates identical dependency trees and returns a nonzero status on high/critical findings or an unavailable audit. The dependency audit is intentionally separate from the credential-free local behavior suite; neither result replaces the other.

To test the **installed** SDK (network access is needed only to install packages):

```bash
cd cloudfunctions/sendMessage
npm ci --ignore-scripts --omit=dev --no-audit --no-fund
cd ../..
npm run test:sdk
```

The one installed tree represents all 14 byte-equivalent locks checked by `check:locks`; do not use this shortcut if future functions have different dependency trees. Missing dependencies fail the suite, not skip it. Tests execute the real SDK and all entry-point source files, replace only the CloudBase request boundary with synthetic responses, and permit only the local HTTP fixture. They verify Date/logic/sort encoding, null-document handling, update/delete/insert result shapes, transaction IDs, serverDate/increment serialization, simulated conflict retry and abort, message authorization/four writes, transactional order creation/replay and claims, conditional order completion, temporary file errors, and Axios JSON/headers/redirect/error/timeout behavior. No real cloud request is made; server-side transactions and identity injection remain unverified.

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

For order claims, the order adapter also runs the **real** `grabOrder/cloud-database-adapter.js` transaction callback against `tests/transactional-cloud-database.js`. That document-store double stages writes, discards them on failure and serializes callbacks for reproducible competing requests. It does not emulate CloudBase locks, automatic conflict retries or SDK wire behavior. The tests establish rollback and retry logic, not platform concurrency guarantees.

接单测试还直接执行真实适配器的事务回调，验证任一写入失败时回滚、竞争接单、重试以及旧会话修复；测试替身会串行化回调，不模拟 CloudBase 的锁、冲突重试或网络协议。平台并发语义仍需隔离环境验证。

The message-transaction regression suite likewise executes the real `sendMessage` adapter. It injects permission changes between the handler precheck and the transaction, verifies denied sends have no message/rate-counter/preview writes, checks current recipient permissions, and exercises failure at each of the four writes. This is local race-boundary evidence, not proof of the deployed SDK's locking behavior.

Currently covered behavior:

- approved mentors receive only generic summaries for unclaimed orders, no other mentor's assigned orders, and full details only for their own assigned orders; owners retain their own details;
- a failed mentor order-list request displays an error instead of actionable fake orders;
- demo recharge and withdrawal buttons cannot mutate local balances or claim real transaction success;
- message history starts with the newest 50 records and supports older pages plus forward polling, including equal timestamps and more than 50 newly arrived records;
- conversation lists scan past stale memberships, return at most 50 authorized entries and expose a continuation even after 200 stale rows; every page rechecks access;
- client history deduplicates pages, retains older records, clears rejected content and ignores unloaded/stale responses; newest-window reconciliation catches a same-timestamp late lower-ID message without advancing past unconsumed forward pages;
- synthetic fixtures are deterministic and internally linked, export Date values in Extended JSON, and support optional private test-account bindings; both generated output and bindings are excluded from Git and Mini Program packaging;
- anonymous question orders store a generic alias and mask the student's profile name from assigned mentors, including legacy title-marked orders; this is not full anonymity;
- chat and mentor reply pages do not show unconfirmed sends as successful messages;
- content search reaches records beyond the first result page, bounds its scan and reports partial results, and ignores late responses after a newer search or input edit;
- every Cloud Function pins the repository-wide `wx-server-sdk` baseline;
- a student or pending mentor cannot list the demand hall;
- students see only their own orders;
- only an explicitly approved mentor can claim an open order;
- a claim transaction failure at any of its three writes leaves order and memberships unchanged;
- competing mentor claims produce one assignment and two memberships in the transaction double;
- a retry by the assigned mentor is idempotent and preserves message previews, timestamps and unread counts;
- approval revoked before the claim transaction and self-claims are rejected; repair of a legacy partially assigned order is tested;
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
- video preparation requires the current acknowledgement version and records it with a server timestamp;
- diagnosis orders use only caller-owned completed analysis tasks, replace client-authored timelines with server results, and bind each task to at most one order;
- cleanup is disabled by default, dry run is non-mutating, timer batches exclude order-bound tasks, failed storage deletion is retryable, and unverifiable legacy uploads require manual review.

## Adding coverage / 增加覆盖

When refactoring another Cloud Function:

1. keep SDK initialization and `OPENID` retrieval in `index.js`;
2. expose only purpose-specific operations from the database adapter;
3. keep authorization and state decisions in a dependency-injected handler;
4. add negative, successful, retry, ownership, and concurrent-state cases where relevant;
5. avoid reproducing CloudBase internals in the in-memory adapter;
6. retain an isolated-environment test for SDK and rule behavior.

The in-memory adapter is test infrastructure, not a CloudBase emulator. If a test depends on SDK query ordering, database indexes, security-rule evaluation, file permissions, or platform identity behavior, record it in the deployment matrix instead of inventing local behavior.
