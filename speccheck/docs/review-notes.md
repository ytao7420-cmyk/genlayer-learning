# SpecCheck review notes

Review date: 2026-10-17. This is an implementation review, not a security audit or a claim that GenLayer has approved the project.

## Scope and observed design

- The contract stores the original request and submitted offer text separately from assessments and selections. No public mutation path for the original records was found.
- The actual transaction sender is recorded as `buyer` or `submitter`. A supplier label is user-provided text and is not proof that the sender represents that supplier.
- Only the recorded buyer can request an assessment or select an offer. Selection requires an evaluated `COMPATIBLE` offer belonging to that request.
- Each validator independently calls the model and compares requirement decisions and cited line IDs with the leader. This checks substantive outputs rather than only the JSON shape.
- Quotations are reconstructed from the submitted evidence text. The application does not verify product authenticity, physical goods, external supplier identity, payments, or delivery.

## Receipt handling

The installed `genlayer-js` version is 1.1.8. Its `waitForTransactionReceipt({status: ACCEPTED})` can resolve for decided failure states such as `UNDETERMINED`, `CANCELED`, and validator/leader timeouts. Resolution must never be treated as success by itself.

Studio receipt arrays can include both a leader receipt and a validator-path receipt. `src/receipt.js` selects the latest entry explicitly marked `mode: leader` where mode information exists, checks `execution_result: SUCCESS`, rejects explicit VM errors and non-return outcomes, and also requires `ACCEPTED` or `FINALIZED`. Missing execution evidence is not success.

Fourteen receipt unit tests passed during this review. These tests cover accepted execution errors, missing evidence, unsuccessful decided statuses, leader/validator array ordering, leader rotation, contradictory VM error fields, and the observed Studio return shape. They do not establish that SpecCheck has deployed or completed a live consensus round.

Seventeen Python contract-rule tests also passed. They use an explicit SDK stub with predetermined independent model answers. They exercise authentication rules, immutable records, request/offer association, compatible-only selection, frozen selections, source citations, deterministic verdict aggregation, and rejection of model disagreement. They do not execute GenVM or demonstrate real model accuracy.

Frontend source review found that user-entered requirements, evidence, labels, explanations, errors, and IDs are escaped before HTML rendering. External transaction links are limited to HTTP(S) and opened with `noopener noreferrer`. The public-data notice is visible before submissions. The review action is limited in the interface to the buyer, evidence length matches the contract's 6,000-character limit, and pending transactions have a resume path that does not submit a duplicate transaction. These are source-review observations, not a claim of browser end-to-end verification.

The live test transcript is scoped to the deployed contract address, and `.local/` is ignored by Git. It contains auxiliary test-wallet material and must remain local; the public evidence file must contain only public addresses, synthetic test input, and transaction references.

SDK 1.1.8 reads `latest-nonfinal` state by default. A successful read-back following `ACCEPTED` can therefore describe an accepted state before finalization. The interface and evidence should not label that state finalized until the network reports `FINALIZED`.

## Limitations and checks still required

- Independent models may agree on a requirement's meaning but cite different lines. Exact citation comparison deliberately fails closed in that case, so valid submissions can fail to reach consensus.
- Consensus compares the requirement IDs, statuses, and cited line IDs. The leader's explanatory `reason` text is displayed but is not compared word-for-word with each validator's explanation.
- Prompt boundaries, explicit allowed outputs, and exact source quotations reduce some failure modes but do not prove immunity to prompt injection or incorrect model judgments.
- No real supplier or customer documents should be entered for the public demonstration. Inputs and assessments are public on-chain data, including the original offer evidence.
- A complete live example must show request creation, offer submission, independent consensus assessment, a successful compliant selection, and read-back of the resulting state. A constructor-only deployment is insufficient evidence.
- Known terminal execution failure should be distinct from an unknown result or read-back failure. Uncertain transactions need their hash preserved so the user can resume status retrieval without duplicate submission.
- Frontend rendering, wallet integration, real GenVM behavior, and live network traces must be reviewed separately when those artifacts are available.
- Request and offer indexes are unpaginated and public creation is permissionless. This prototype does not establish acceptable read performance under large-scale or hostile usage.

## References

- Installed SDK: `node_modules/genlayer-js/README.md`, `dist/index.cjs`, and `dist/chunk-GJXSECNH.cjs` (version 1.1.8).
- [GenLayer transaction execution](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/transactions/transaction-execution): EVM inclusion and Intelligent Contract execution are distinct stages.
- [GenLayer transaction receipts](https://docs.genlayer.com/api-references/genlayer-node/gen/gen_getTransactionReceipt): execution outcome is distinct from lifecycle status. Current node documentation can differ from the pinned SDK and Studio schema; this implementation targets Studionet, chain 61999.
