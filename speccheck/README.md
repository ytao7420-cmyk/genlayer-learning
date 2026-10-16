# SpecCheck

SpecCheck compares a supplier's submitted quotation with a buyer's fixed procurement requirements. A GenLayer Intelligent Contract obtains independent AI assessments, records evidence for each requirement, and lets the buyer select a compatible offer without transferring funds.

The trust problem is specific: a buyer and an offer submitter can inspect the same frozen specification, the same original quotation, and the assessment that preceded selection. The application records what the submitted text supports. It does not establish whether the goods or supplier claims are true.

## Workflow

1. Connect a wallet and create a request with 1–6 mandatory requirements.
2. Submit one or more offers. The contract records each transaction sender, supplier label, and original evidence text.
3. The request's buyer runs a consensus review. Every requirement receives `MATCH`, `MISMATCH`, or `NOT_STATED`, an original source quotation where available, and an explanation.
4. Deterministic code combines the findings into `COMPATIBLE`, `INCOMPATIBLE`, or `INCOMPLETE`.
5. The buyer can select an evaluated, compatible offer belonging to that request. Selection freezes the request; all existing offers and assessments remain readable.

Each offer is assessed at most once. Corrections require a new offer. Changed requirements require a new request. Selection records a buyer decision; it does not issue a purchase order, settle a dispute, or create a payment.

## Deployment and evidence

The contract is deployed on GenLayer Studionet (chain 61999) at `0x14664A4ABB0582398F8E9a97ce519BA8b57b98Ed`. [public/deployment.json](public/deployment.json) records the deployment transaction as `FINALIZED`, its deployer, and the source SHA-256. An empty address or `deployed: false` in a later configuration means live actions are not configured.

The completed synthetic demonstration in [public/evidence/demo.json](public/evidence/demo.json), recorded at `2026-10-16T21:02:38.477Z`, contains eight successful chain transactions, receipt execution results, validator votes, and contract state read-backs. All three AI evaluations ran with `leaderOnly: false`: Sample A returned `COMPATIBLE`, Sample B `INCOMPATIBLE`, and Sample C `INCOMPLETE`. The buyer selected Sample A; the request read-back is `SELECTED` with `selected_offer_id: demo-offer-match-v1`.

At that recording time, six demonstration transactions were `FINALIZED`; the missing-warranty evaluation and final selection were `ACCEPTED`. All eight recorded execution results were `SUCCESS`. Each AI evaluation recorded three `agree` votes and two `idle` entries. Idle entries are not affirmative votes. Both auxiliary actors are project-controlled wallets, and all offers are synthetic examples.

The **Live** interface reads the configured contract. **Recorded demo** reads the evidence archive and is explicitly read-only; it is not a fresh network verification. `ACCEPTED` and `FINALIZED` are different lifecycle states. Evidence is only finalized when its recorded transaction status says `FINALIZED`.

Source: [ytao7420-cmyk/genlayer-learning/speccheck](https://github.com/ytao7420-cmyk/genlayer-learning/tree/main/speccheck).

Expected website: [SpecCheck](https://speccheck-genlayer-57.sales136152.chatgpt.site). **Publication and browser verification are pending** in this documentation; the URL alone is not evidence of a working hosted application.

## Run locally on Windows

Use Node.js **22.12 or later**, npm, and a current browser with a compatible Ethereum wallet such as MetaMask. The installed Vite 7 toolchain requires Node `^20.19.0 || >=22.12.0`. Python 3.9 or later is needed only for the contract-rule tests below.

Open PowerShell in the SpecCheck project directory (`speccheck` in the repository layout):

```powershell
node --version
npm --version
npm ci
npm run dev
```

Open the localhost URL printed by Vite. No application API key or private key belongs in the frontend. The browser wallet signs live writes; public reads do not require connecting a wallet.

Build and inspect the production bundle:

```powershell
npm run build
npm run preview
```

These commands use the repository's lockfile. They are the Windows setup instructions, not a claim that a Windows machine was used for this project's verification.

## Deploy the contract through GenLayer Studio

1. Open [GenLayer Studio](https://studio.genlayer.com) and connect the intended deployment wallet.
2. Use **Studionet**, chain ID **61999** (`0xf22f`), RPC `https://studio.genlayer.com/api`. This is different from the Studio-dev preview on chain 61997.
3. Create or upload [contracts/speccheck.py](contracts/speccheck.py). Keep its pinned runner dependency header intact. The constructor has no arguments.
4. Deploy, follow the transaction, and inspect both its lifecycle status and execution result. Record the returned contract address only after successful execution.
5. Set the verified address and `deployed: true` in `public/deployment.json`, preserving the Studionet network settings. Rebuild the frontend after changing that file.
6. Verify a read such as `get_requests`, then exercise request creation, offer submission, actual AI evaluation, and selection with public synthetic data.

The frontend is pinned to **`genlayer-js` 1.1.8**. It uses `createClient`, `readContract`, and `writeContract`, and performs standard wallet network switching directly. This avoids the older SDK `connect()` path that requests a GenLayer Snap. All application write calls use `value: 0n` and `leaderOnly: false`.

Studionet is a development environment with simulated balances and temporary state. Its EVM wallet layer is gasless; protocol fee behavior can differ across network versions. Do not send real assets to fund this demonstration. Use the built-in Studio faucet if the target environment requires test balances. Network resets can remove deployed contracts and demonstration state.

## Reproduce the synthetic demonstration

The source fixtures are the `requirements` and `examples` values in [scripts/live-test.mjs](scripts/live-test.mjs). They describe an industrial USB hub and three submitted offers:

| Fixture | Recorded chain finding |
| --- | --- |
| Sample A: four USB-A ports, aluminum enclosure, 24-month warranty | `COMPATIBLE` |
| Sample B: explicitly plastic rather than metal | `INCOMPATIBLE` |
| Sample C: no warranty statement | `INCOMPLETE` |

These findings were read back from the deployed contract in the recorded run. They concern synthetic quotation text and make no claim about an actual supplier. The script also uses them as expected outcomes for reproduction and stops if a later run differs.

After a successful deployment has been configured:

```powershell
New-Item -ItemType Directory -Force public/evidence | Out-Null
node scripts/live-test.mjs
```

The script creates two auxiliary test wallets in `.local/test-wallets.json`: a buyer and an offer submitter. **Both wallets are controlled by this project. They are not independent customers or commercial adoption.** Their private keys stay in the ignored `.local/` directory; only their public addresses appear in published evidence. The script submits zero-value transactions to Studionet, runs real consensus assessments, selects the compatible offer, and writes `public/evidence/demo.json` only after its checks complete.

`.local/live-transcript.json` preserves submitted hashes so a rerun can resume the same demonstration instead of blindly resubmitting. Keep it with its original deployment and test wallets. A new deployment needs its own demonstration state; do not reuse a transcript from a different contract. Inspect a failed or still-pending transaction before deciding what to do next.

## Tests and verification boundaries

```powershell
npm test
py -3 -m unittest discover -s tests -p "test_contract.py" -v
npm run build
```

On systems without the Windows Python launcher, replace `py -3` with `python3`.

- `tests/test_contract.py` uses an explicit SDK stub and predetermined model answers. It tests access control, immutable records, source citations, independent-answer disagreement, verdict aggregation, selection rules, and input boundaries. It does **not** run GenVM, real LLMs, signatures, or network consensus.
- `tests/receipt.test.mjs` tests the interpretation of lifecycle and execution evidence. A receipt becoming available is not sufficient proof of successful contract execution.
- Studio schema loading verifies the interface can be parsed. Deployment verifies constructor execution. The live demonstration provides separate evidence for the application workflow and model calls.

See [architecture](docs/architecture.md) for the exact state transitions and [review notes](docs/review-notes.md) for implementation-review observations. Neither document is a third-party audit or GenLayer approval.

## Contract interface

All four views return JSON strings. Requirement IDs in assessment items are one-based integers corresponding to the stored requirement array.

| Method | Caller and result |
| --- | --- |
| `create_request(request_id, title, requirements_json)` | Any wallet; records that sender as buyer and freezes the requirements |
| `submit_offer(offer_id, request_id, supplier_label, evidence)` | Any wallet while the request is open; records that sender as submitter |
| `evaluate_offer(offer_id)` | Request buyer only; open request and unassessed offer required |
| `select_offer(request_id, offer_id)` | Request buyer only; selects an evaluated compatible offer and freezes the request |
| `get_requests()` | Public request array |
| `get_request(request_id)` | Public request object |
| `get_offers(request_id)` | Public offer array for one request |
| `get_offer(offer_id)` | Public offer object, including any assessment |

Contract input limits: IDs 80 characters; title 160; supplier label 120; each requirement 500; serialized requirements JSON 6,000; offer evidence 6,000. A request contains 1–6 non-empty requirements.

## Important boundaries

- **Public text only.** Requests, quotations, wallet addresses, assessments, and selections are public. Never submit confidential prices, private customer documents, contact information, credentials, or other sensitive material.
- **Text assessment is not product verification.** A supplier label is an unverified label. A wallet signature identifies the submitting wallet, not a legal entity, manufacturer, real customer, or authentic product.
- **Models can be wrong.** Independent agreement is not proof of factual correctness. Ambiguity, prompt injection, multilingual wording, and shared model errors remain possible. The buyer must inspect the source and findings.
- **Exact citations can reject otherwise sensible results.** Validators must agree on each status and its sorted evidence line IDs. Different valid citation choices can prevent consensus. Explanatory wording may differ; the accepted leader's reason is displayed.
- **A quote is reconstructed, not generated.** For multiple cited lines, the contract returns the continuous original span between the first and last cited line, including any intervening lines. Missing evidence can produce an empty quote.
- **No payments.** No escrow, token transfer, settlement, fulfillment guarantee, supplier certification, or financial return is implemented.
- **Prototype scale.** Lists are unpaginated. Offers are indexed per request, but the project does not demonstrate performance under large-scale or hostile usage.

## License

Original project code is available under the [MIT License](LICENSE). Third-party dependencies retain their respective licenses.
