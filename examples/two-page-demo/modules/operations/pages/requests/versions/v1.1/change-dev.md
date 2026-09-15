# Service Requests - Development Change v1.1

Parent: v1.0
Source: Example customer feedback: show request priority

## 1. Source Items

| ID | Source wording | Classification |
| --- | --- | --- |
| SRC-002 | Show request priority without widening the table. | Requirement and interaction optimization |

## 2. Effective Changes

| ID | Parent behavior | New behavior | Requirement | Evidence |
| --- | --- | --- | --- | --- |
| CHG-001 | The record cell shows only the request id. | Show priority beneath the request id. | REQ-002 | ASIS-001 |

## 3. Flow Impact

The action flow is unchanged. Reviewers can scan priority before running the action.

## 4. Acceptance Delta

- [ ] TST-003 proves CHG-001 and REQ-002.

Unmentioned parent requirements remain effective. The complete truth is maintained in snapshot-dev.md.
