# GenLayer Portal project submission draft

These are draft field values grounded in the completed Studionet demonstration and its evidence files. They do not assert an accepted contribution, award, payment, or real customer usage. Website publication and browser verification remain pending in this document.

## Project name

SpecCheck

## Short introduction — maximum 180 characters

SpecCheck uses GenLayer AI consensus to compare supplier quotations with frozen RFQ requirements, preserve source evidence, and record the buyer's choice without payments.

## Description — maximum 1,000 characters

SpecCheck compares supplier quotations with frozen RFQ requirements through a GenLayer Intelligent Contract. A buyer records 1-6 requirements; wallets submit original evidence with a sender address and SHA-256 commitment. The leader and validators independently assess each requirement as MATCH, MISMATCH, or NOT_STATED, comparing decisions and cited line IDs. Code reconstructs source quotations and deterministically aggregates the verdict. Only the buyer can select an evaluated compatible offer, freezing the request and preserving history. A completed Studionet run recorded COMPATIBLE, INCOMPATIBLE, and INCOMPLETE outcomes and selected the compatible offer. The evidence archive includes eight successful transactions, validator votes, and state read-backs. Both test wallets are project-controlled; all offers are synthetic, not customers. The browser UI supports live actions and recorded evidence. No payments occur; the system checks text claims, not product authenticity or fulfillment.

## Expected verification — maximum 500 characters

Inspect deployment.json and evidence/demo.json: finalized deployment; eight successful workflow transactions; validator votes; COMPATIBLE, INCOMPATIBLE, and INCOMPLETE results; compatible offer selected. At recording, six workflow transactions were FINALIZED and two ACCEPTED. Reproduce the public synthetic USB-hub cases and inspect source quotes and frozen history. Local stub tests separately cover access control and contract rules, not real model accuracy or network consensus.

## Evidence fields to resolve before submission

| Field | Recorded value or publication status |
| --- | --- |
| Public repository | [genlayer-learning/speccheck](https://github.com/ytao7420-cmyk/genlayer-learning/tree/main/speccheck) |
| Expected application URL | [SpecCheck](https://speccheck-genlayer-57.sales136152.chatgpt.site); publication and browser verification pending |
| Contract address | `0x14664A4ABB0582398F8E9a97ce519BA8b57b98Ed`; deployment recorded `FINALIZED` in [deployment.json](../public/deployment.json) |
| Demonstration transactions | Eight successful transactions with hashes, receipt results, votes, and read-backs in [demo.json](../public/evidence/demo.json) |
| Recorded workflow status | Six `FINALIZED`, two `ACCEPTED` at `2026-10-16T21:02:38.477Z`; do not relabel them |
| Screenshots | Captured from the working application after live evidence exists |

The synthetic actors' addresses identify project-controlled test wallets. They must not be described as independent users, customers, suppliers, commercial activity, or external validation.
