# Service Requests - Test Specification

> Complete effective test specification. Version: v1.1

## 1. Preconditions

Open the built requests HTML with a current desktop browser.

## 2. Happy Path

| Case | Steps | Expected | Requirement |
| --- | --- | --- | --- |
| TST-001 | Open the page. | Two rows show id, status, and amount. | REQ-001 |
| TST-003 | Open the page at desktop and mobile widths. | Priority appears beneath each request id with no additional column. | REQ-002 |

## 3. Rejections And Boundaries

| Case | Scenario | Expected | Requirement |
| --- | --- | --- | --- |
| TST-002 | Click Run action while a blocked row exists. | The notice describes the blocked sample. | INT-001 / RULE-001 |

## 4. Regression

- [ ] The page remains usable at 375 px and 1280 px widths.
