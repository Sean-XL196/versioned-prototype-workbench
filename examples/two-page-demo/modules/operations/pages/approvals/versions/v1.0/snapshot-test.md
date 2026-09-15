# Approvals - Test Specification

> Complete effective test specification. Version: v1.0

## 1. Preconditions

Open the built approvals HTML with a current desktop browser.

## 2. Happy Path

| Case | Steps | Expected | Requirement |
| --- | --- | --- | --- |
| TST-001 | Open the page. | Two rows show id, status, and amount. | REQ-001 |

## 3. Rejections And Boundaries

| Case | Scenario | Expected | Requirement |
| --- | --- | --- | --- |
| TST-002 | Click Run action while a blocked row exists. | The notice describes the blocked sample. | INT-001 / RULE-001 |

## 4. Regression

- [ ] The page remains usable at 375 px and 1280 px widths.
