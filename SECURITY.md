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
- Conversation reads and writes require a matching membership document.
- Protected profile and order mutations are server-side operations.
- Model-provider keys belong in Cloud Function environment variables.
- Deployment owners are responsible for restrictive database and storage rules.

## Known limitations

- The reference approval step is a manual trusted-operator operation. Production deployments still need a reviewed identity-verification channel, reviewer authorization, privacy controls, and auditable decisions.
- The wallet is simulated and must not be connected to real payments.
- Uploaded videos may be shared with the configured external model provider through temporary URLs. Consent, retention, deletion, and vendor terms must be handled by the deployer.
- Video analysis and message sending have caller-scoped rate limits and bounded requests; message retries are idempotent. Order/general-upload rate limits, broader abuse monitoring, content moderation, audit logging, and automated deletion are not yet complete.

These limitations are tracked in [docs/ROADMAP.md](docs/ROADMAP.md).
