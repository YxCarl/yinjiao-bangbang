# Deployment guide

This guide describes a development deployment. It is not a substitute for a privacy, security, or legal review.

## 1. Prepare a Mini Program

1. Create or select a WeChat Mini Program and enable Cloud Development.
2. Open this repository in WeChat Developer Tools.
3. Replace the generic `touristappid` locally with your own AppID or use the tool's private project configuration.
4. Select the cloud environment that should be used by the project. `app.js` intentionally contains no committed environment ID.

Do not commit your private tool configuration, credentials, or production identifiers.

## 2. Create collections

Create `users`, `orders`, `messages`, `conversations`, `contents`, and `aiTasks`.

Recommended baseline:

- deny public writes to all collections;
- permit protected writes only through Cloud Functions;
- restrict `users`, `orders`, `messages`, `conversations`, and `aiTasks` by authenticated ownership or server-side authorization;
- review indexes required by compound queries in the Cloud console;
- keep `contents` read-only for ordinary users.

Rules differ by deployment and must be tested against both authorized and unauthorized cases.

## 3. Deploy functions

Deploy every directory below `cloudfunctions/`:

- `addOrder`
- `analyzeVideo`
- `completeOrder`
- `getContents`
- `getConversations`
- `getMessages`
- `getOrders`
- `grabOrder`
- `loginOrFetch`
- `sendMessage`
- `updateProfile`

Use cloud-side dependency installation. Keep the SDK versions declared by each function until an upgrade is tested in a separate pull request.

## 4. Configure video analysis

Set `ZHIPU_API_KEY` as an environment variable on `analyzeVideo`. Leave it unset to disable the feature safely.

Before enabling analysis for real recordings:

- obtain consent from every required participant or guardian;
- disclose the external processor and transfer purpose;
- define maximum file size, duration, and retention;
- provide deletion and access-request procedures;
- avoid recording unrelated students or sensitive classroom information.

## 5. Validate

Run locally:

```bash
npm test
```

Then verify in WeChat Developer Tools:

- both roles can enter their intended pages;
- unauthorized users cannot list mentor orders;
- only order participants can read and send messages;
- profile updates cannot change role or balance;
- only the assigned mentor can complete an order;
- video tasks cannot be read by another user;
- logs do not contain credentials, full message bodies, or personal data.

## Production-hardening checklist

- [ ] Implement independent mentor verification and approval.
- [ ] Replace simulated wallet behavior with no payment feature, or complete a separate regulated payment design.
- [ ] Add rate limits and abuse monitoring.
- [ ] Add content moderation and reporting flows.
- [ ] Define retention and automated deletion for files, messages, and AI tasks.
- [ ] Review database and storage rules with negative authorization tests.
- [ ] Enable private vulnerability reporting and branch protection.
- [ ] Back up data and test recovery.
- [ ] Complete privacy notices, consent flows, and any required local compliance review.
