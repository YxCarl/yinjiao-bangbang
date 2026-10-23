# Security policy

## Supported versions

Security fixes are applied to the latest code on `main`. This project has not yet published a stable production release.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for this repository when available. If it is unavailable, contact the maintainer through the GitHub profile and request a private reporting channel without publishing exploit details.

Include, where possible:

- the affected page, Cloud Function, or data collection;
- prerequisites and minimal reproduction steps;
- the potential impact;
- a suggested mitigation;
- whether any real user data may have been exposed.

Please do not access data that is not yours, disrupt a deployment, or retain sensitive data while testing.

## Security boundaries

- Cloud Functions trust `OPENID` from the WeChat runtime, not identity fields supplied by pages.
- Mentor-sensitive functions require both `role: mentor` and `mentorStatus: approved`; the public application flow cannot write approval.
- Non-order conversations require a matching membership document. Order conversations recheck the student owner or currently assigned approved mentor against the order; an authorized participant can repair a missing membership, while a stale membership alone grants no access.
- Message commits re-read the sender membership, current order and assigned mentor inside the same transaction as the message, previews and rate counter. Candidate recipients are revalidated before preview/unread writes, including on SDK transaction retries; a handler precheck alone is not the commit authorization.
- The mentor demand hall returns only generic summaries for unclaimed orders; full details are returned only to the owner or currently assigned, approved mentor. Deploy the current `getOrders` function and mentor page together before introducing any real order data.
- Question orders with `anonymous: true` store a generic student alias instead of the profile name; mentor order and conversation reads also mask legacy `【匿名】` question orders. This hides the profile name from mentors, not the account from CloudBase operators or identities voluntarily disclosed in question text or voice.
- Protected profile and order mutations are server-side operations.
- Model-provider keys belong in Cloud Function environment variables.
- Deployment owners are responsible for restrictive database and storage rules.

## Known limitations

- The 2026-10-22 security candidate replaces the old SDK tree (12 affected entries) with a locked tree reporting zero audit findings. It requires explicit Axios/database overrides; the database override changes BSON and transaction request behavior and is published under upstream's `next` tag. Installed-SDK contracts pass, but cloud compatibility and installer enforcement of overrides remain unverified. See [the merge/deployment gate](docs/DEPENDENCIES.md); this is not production security clearance.
- The reference approval step is a manual trusted-operator operation. Production deployments still need a reviewed identity-verification channel, reviewer authorization, privacy controls, and auditable decisions.
- The wallet is simulated and must not be connected to real payments.
- Mentor income, ratings, reviews, course uptake, and the sample content catalog are not verified operational metrics. Demo-only actions must not claim real payment, settlement, or teaching outcomes.
- Order claiming now rechecks mentor approval and order ownership inside the transaction that assigns the order and creates/repairs both memberships. New membership IDs are deterministic; retries preserve message previews and unread counts. Deploy `grabOrder` and `sendMessage` together in an isolated environment before using the change. Local rollback/race tests run the real adapter callback against a deterministic transaction double, not the CloudBase locking engine; SDK concurrency and legacy-data migration still require platform verification.
- Message and conversation reads support timestamp-plus-document-ID cursors and reauthorize every page. Pages contain at most 50 results; conversation reads scan at most 200 memberships per request and return a continuation cursor when the scan cap is reached. Cursor scope validation is not authorization. Date fields must be database Dates, not strings. Pagination is not a database snapshot: refresh the list for conversations moved ahead of an older cursor. Automatic/manual newest-window reconciliation covers late messages within that 50-record window; older delayed writes can require reopening and paging through history.
- Uploaded videos may be shared with the configured external model provider through temporary URLs. Consent, retention, deletion, and vendor terms must be handled by the deployer.
- Video task preparation requires a versioned acknowledgement stored with server time. Diagnosis orders reload a caller-owned completed task, use its server-stored timeline, and atomically bind the task to at most one order.
- Order creation, message sending, and video analysis have caller-scoped rate limits and bounded inputs; order and message retries are idempotent. Lesson-plan, voice, and video uploads use server-issued request-bound paths, with server-side size checks for lesson plans and videos. Orphan cleanup, broader abuse monitoring, content moderation, audit logging, and automated deletion are not yet complete.
- Lesson-plan size and path checks occur when a new order is created. The baseline owner-only storage rule does not provide a server-managed immutable archive; deployments that require evidentiary attachment integrity must finalize uploads into an immutable server-controlled location or revalidate them on access.
- `cleanupExpiredData` is disabled by default and covers only new cleanup-eligible, unbound AI tasks plus expired rate-limit records. Active business records, order-bound attachments, messages, account deletion, and legacy uploads without a verified file ID require an explicit deployment policy and review.
- Deployments must deny client invocation of `cleanupExpiredData`; its timer-shaped event check is not an authorization mechanism.

These limitations are tracked in [docs/ROADMAP.md](docs/ROADMAP.md).
