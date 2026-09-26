# Candidate Cloud Database indexes / 云数据库索引清单

These are **manual configuration candidates for a fresh, isolated document-database environment**, not indexes created by this repository. They were derived from the committed `where` + `orderBy` calls. Confirm the actual CloudBase database mode, index rules, query planner, and collection sizes in your own test environment before deployment. Never apply an index change directly to a historical environment without reviewing its data and rollback plan.

以下为根据仓库中 `where` 与 `orderBy` 查询整理的**新隔离文档型数据库环境候选索引**，仓库不会自动创建它们。部署前应在自己的测试环境确认数据库模式、索引规则、查询计划与数据量；不要未经检查就在历史环境直接修改。

| Collection | Candidate fields in order | Used by |
| --- | --- | --- |
| `orders` | `status` ↑, `createTime` ↓ | `getOrders`: available orders in the mentor hall |
| `orders` | `teacherId` ↑, `createTime` ↓ | `getOrders`: orders assigned to the approved mentor |
| `orders` | `_openid` ↑, `createTime` ↓ | `getOrders`: student's own orders |
| `contents` | `type` ↑, `sort` ↑ | `getContents`: type-filtered resources |
| `contents` | `sort` ↑ | `getContents`: unfiltered resources and bounded keyword scan |
| `conversations` | `_openid` ↑, `lastTime` ↓ | `getConversations`: caller's conversation list |
| `conversations` | `_openid` ↑, `conversationId` ↑ | `getMessages`, `sendMessage`, protected voice access: membership lookup |
| `messages` | `conversationId` ↑, `createTime` ↓ | `getMessages`: newest 50 messages, reversed for display |
| `messages` | `conversationId` ↑, `fileID` ↑, `kind` ↑ | `getProtectedFileURL`: stored voice-file lookup |
| `users` | `_openid` ↑, `role` ↑, `mentorStatus` ↑ | mentor-approval lookups in order, message, and file functions |
| `aiTasks` | `cleanupEligible` ↑, `expiresAt` ↑ | `cleanupExpiredData`: bounded expiry scan |
| `rateLimits` | `expiresAt` ↑ | `cleanupExpiredData`: expired counters |

`↑` means ascending and `↓` descending. The order matters: equality fields precede sort or range fields. Some shorter queries may use the leftmost prefix of a longer index; avoid adding redundant indexes blindly. This is a review checklist, **not** a guarantee that every query will use an index or that the listed indexes are sufficient for production traffic. The keyword search still scans up to 300 sorted records per request; indexes do not turn that scan into full-text search.

`↑` 表示升序，`↓` 表示降序。等值条件排在排序或范围条件前；较短查询可能复用组合索引的最左前缀。不要机械添加重复索引。本表是检查清单，**不是**所有查询必然命中索引或足以承载生产流量的保证。关键词检索仍会在单次请求中最多扫描 300 条内容，索引不会将其变成全文搜索。

## Verification in an isolated environment / 隔离环境验证

1. Create the seven documented collections first. Open each collection's **Index Management** page in the CloudBase console and add only the candidates needed by enabled features.
2. Deploy `getOrders`, `getContents`, `getMessages`, `getConversations`, `getProtectedFileURL`, and the other required functions to that environment; do not overwrite the historical environment.
3. Use synthetic student and mentor accounts. Verify that an approved mentor sees only generic summaries for open orders, never another mentor's assigned orders, and receives details only after claiming an order. Verify that the student still sees their own details.
4. Test the other listed queries with synthetic data, review any missing-index error and the console's index usage/explain data where available, then adjust this list with the actual observed result. Check both sort order and large-enough data sets; a one-document test cannot establish query performance.
5. Record sanitized pass/fail evidence in [Testing and evidence](TESTING.md). Do not publish account IDs, file IDs, classroom material, or private order details.

Tencent CloudBase documents [index management](https://docs.cloudbase.net/en/database/data-index) and [compound-index query planning](https://docs.cloudbase.net/en/recipes/optimize-database-query-performance). Its documentation may change; check the version applicable to the environment you deploy.
