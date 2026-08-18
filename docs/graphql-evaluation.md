# GraphQL Evaluation

## Decision

Status: **no-go for current release**.

No concrete GraphQL consumer, schema owner, or approved query-composition requirement exists in repository evidence. REST already serves frontend callers, and API versioning now defines `/v1` as compatibility boundary.

## Security and operations reason

Adding GraphQL now would introduce a second authorization and pagination surface without a named consumer. It would require field-level RBAC/site isolation, depth and complexity limits, query timeouts, rate limits, resolver query-count tests, schema ownership, and separate observability. No GraphQL dependency exists in backend manifest evidence.

## Reconsideration gate

Reopen only with:

1. Named consumer and query use case that `/v1` REST cannot satisfy.
2. Approved schema owner and compatibility policy.
3. Read-only bounded schema design; no direct TypeORM entity exposure.
4. Existing JWT, role, site isolation, pagination, depth/complexity, timeout, and rate-limit tests.
5. Runtime E2E and operational evidence.

No GraphQL package or runtime surface added.
