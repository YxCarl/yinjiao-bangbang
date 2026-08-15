# Deployment guide

This guide describes a development deployment. It is not a substitute for a privacy, security, or legal review.

## 1. Prepare a Mini Program

1. Create or select a WeChat Mini Program and enable Cloud Development.
2. Open this repository in WeChat Developer Tools.
3. Replace the generic `touristappid` locally with your own AppID or use the tool's private project configuration.
4. Select the cloud environment that should be used by the project. `app.js` intentionally contains no committed environment ID.

Do not commit your private tool configuration, credentials, or production identifiers.

## 2. Create collections

Create `users`, `orders`, `messages`, `conversations`, `contents`, `aiTasks`, and `rateLimits`.

Apply the deny-client-access rule from `security/database-rules.json` to every collection. The Mini Program uses Cloud Functions for database access, so ordinary client SDK requests should have neither read nor write access.

Review the indexes required by compound queries in the Cloud console. The rules are configured per collection; do not assume that creating the JSON file deploys them automatically.

## 3. Configure storage protection

Deploy the updated client and `getProtectedFileURL` before applying `security/storage-rules.json`. The storage rule permits direct access only to the file creator. Cross-user access to order attachments and voice messages is issued by the Cloud Function only after order or conversation authorization.

Follow [CloudBase security rules](SECURITY_RULES.md) for the safe rollout order and the required positive and negative tests.

## 4. Deploy functions

Deploy every directory below `cloudfunctions/`:

- `addOrder`
- `analyzeVideo`
- `completeOrder`
- `getContents`
- `getConversations`
- `getMessages`
- `getOrders`
- `getProtectedFileURL`
- `grabOrder`
- `loginOrFetch`
- `sendMessage`
- `submitMentorApplication`
- `updateProfile`

Deploy the updated Mini Program pages together with `addOrder` and `sendMessage`. Both functions require bounded client request IDs. Order creation and message sending use server-side Cloud Database transactions, so isolated-environment testing must cover a new request, replay of the same request ID, and an ambiguous client retry.

The reference message policy permits 30 new messages per caller per minute. A replay does not consume another slot or increment unread state twice. Voice messages must reference an MP3 below the `chat/` storage prefix and declare a duration from 1 to 60 seconds.

Use cloud-side dependency installation. Keep the SDK versions declared by each function until an upgrade is tested in a separate pull request.

All committed functions pin the same SDK baseline. Follow the review, isolated deployment, evidence, and rollback procedure in [Dependency policy](DEPENDENCIES.md) before changing it.

## 5. Configure video analysis

Set `ZHIPU_API_KEY` as an environment variable on `analyzeVideo`. Leave it unset to disable the feature safely. `ZHIPU_VIDEO_MODEL` is optional and defaults to `glm-4v-plus`.

The reference policy allows at most three new analysis tasks per caller per hour, rejects actual cloud objects at or above 200MB, limits declared duration to 10 minutes, and records seven-day expiry metadata on task documents. Analysis uses the provider's asynchronous submit/result APIs and closes tasks that remain processing for more than 15 minutes. Configure scheduled deletion for expired `aiTasks`, rate-limit records, and unreferenced uploads before processing real recordings; expiry metadata alone does not delete data.

Before enabling analysis for real recordings:

- obtain consent from every required participant or guardian;
- disclose the external processor and transfer purpose;
- define maximum file size, duration, and retention;
- provide deletion and access-request procedures;
- avoid recording unrelated students or sensitive classroom information.

## 6. Validate

Run locally:

```bash
npm test
```

The local suite includes repository checks and behavior-level tests for selected deployed handlers using deterministic in-memory adapters. It requires no AppID or cloud credential. Read [Testing and evidence](TESTING.md) before interpreting the result: local tests do not validate SDK queries or deployed security rules.

Then verify in WeChat Developer Tools:

- a client-selected mentor request creates only a student profile;
- a pending mentor application cannot enter the mentor workspace or list mentor orders;
- only a trusted console approval that sets both `role: mentor` and `mentorStatus: approved` grants mentor access;
- revoking approval immediately blocks mentor order, conversation, and protected-file access;
- unauthorized users cannot list mentor orders;
- only order participants can read and send messages;
- replaying one message request creates one document and increments peer unread state once;
- a caller's thirty-first new message in one minute is rejected while an existing request ID remains replayable;
- profile updates cannot change role or balance;
- only the assigned mentor can complete an order;
- video tasks cannot be read by another user;
- direct database reads and writes are rejected by every collection;
- a fourth new video-analysis task within one hour is rejected while replaying an existing request ID is allowed;
- an arbitrary cloud file ID that does not match the server-issued task path is rejected;
- an actual video object at or above 200MB is rejected before the external provider call;
- a valid video starts as `processing`, survives a page reload through the locally retained task ID, and later reaches `done` through status polling;
- status responses never return provider task IDs, temporary URLs, owner IDs, or server-side file metadata;
- the assigned mentor can open a student attachment but an unrelated mentor cannot;
- conversation members can play each other's voice messages but a non-member cannot;
- arbitrary cloud file IDs do not receive a temporary URL;
- logs do not contain credentials, full message bodies, or personal data.

Follow [Mentor approval](MENTOR_APPROVAL.md) for the application states, trusted review operation, legacy-record migration, and two-account negative tests.

## Production-hardening checklist

- [ ] Replace the reference manual approval operation with a production-reviewed identity-verification and reviewer-audit process.
- [ ] Replace simulated wallet behavior with no payment feature, or complete a separate regulated payment design.
- [ ] Add the remaining order/general-upload rate limits and broader abuse monitoring.
- [ ] Add content moderation and reporting flows.
- [ ] Define retention and automated deletion for files, messages, and AI tasks.
- [ ] Review database and storage rules with negative authorization tests.
- [ ] Enable private vulnerability reporting and branch protection.
- [ ] Back up data and test recovery.
- [ ] Complete privacy notices, consent flows, and any required local compliance review.
