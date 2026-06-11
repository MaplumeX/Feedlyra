# Bug Analysis: Virtualized Scroll Read Marks Were Skipped

## 1. Root Cause Category

* **Category**: E - Implicit Assumption, with a D - Test Coverage Gap.
* **Specific cause**: The implementation assumed every mounted Virtuoso row would
  receive an asynchronous IntersectionObserver exit notification before Virtuoso
  unmounted it. Virtualization does not provide that lifecycle guarantee.

## 2. Why Earlier Fixes Failed

1. The precision fix improved observer ownership, direction checks, and boundary
   conditions, but preserved the incorrect assumption that observer delivery wins the
   race with row unmount.
2. The accuracy fix removed a stale one-second timing guard and stopped data mutations
   from clearing pending state. Those were real missed-mark paths, but they did not
   cover rows that never reached the observer callback at all.
3. Existing tests covered cache transitions and pagination helpers, not an actual
   virtualized multi-row scroll, so sparse IDs such as 6 and 13 appeared correct once
   they reached the backend while the missing IDs were invisible to tests.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Use guarded Virtuoso range tracking to enumerate crossed indexes instead of relying on row DOM lifetime | Done |
| P0 | Documentation | Record the guarded range contract and forbid unguarded range callbacks | Done |
| P0 | Test coverage | Unit-test multi-row range collection and verify the real Virtuoso flow with continuous and direct-jump scrolling | Done |
| P1 | Code review | For virtualized-list side effects, ask whether the logic depends on callbacks from rows that may already be unmounted | Done in component guideline |

## 4. Systematic Expansion

* **Similar issues**: Analytics, prefetch, acknowledgement, or selection logic attached
  to virtualized row mount/unmount or observer callbacks can lose events for the same
  reason.
* **Design improvement**: Use the virtualizer's index/range model for exhaustive
  operations and DOM observers only for best-effort visual effects.
* **Process improvement**: Reproduce virtual-list bugs against the real virtualizer and
  record complete emitted ID sequences, rather than validating only the IDs that reach
  the API.

## 5. Knowledge Capture

* [x] Updated frontend component guidelines with the guarded range pattern.
* [x] Updated frontend quality guidelines to forbid unguarded range callbacks.
* [x] Added focused regression coverage and documented browser verification.
