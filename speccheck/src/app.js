import './style.css';
import {
  connectWallet, getConfig, getRequests, getRequest, createRequest,
  submitOffer, evaluateOffer, getOffers, getOffer, selectOffer, onStatus, loadDemoEvidence,
  pendingTransaction, resumePendingTransaction,
} from './chain.js';

const app = document.querySelector('#app');
const state = {
  mode: 'recorded', config: {}, wallet: '', requests: [], offers: [],
  activeId: null, offerId: null, view: 'review', search: '', loading: true,
  pending: false, modal: null, demo: null, detailEpoch: 0,
  notice: null, status: null, formError: '', recoverable: null,
  requestDraft: { title: '', requirements: ['', '', ''] },
  offerDraft: { supplier: '', evidence: '' },
};

const icons = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  link: '<path d="M14 4h6v6m0-6-9 9M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  wallet: '<path d="M20 8H5a2 2 0 0 1 0-4h13v4M4 6v12a2 2 0 0 0 2 2h14V8m0 4h-5v4h5"/>',
  file: '<path d="M14 3H6v18h12V7l-4-4Zm0 0v5h4M9 12h6m-6 4h6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9l10-6Zm-10 12 10 6 10-6M2 12l10 6 10-6"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.file}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const same = (a, b) => String(a) === String(b);
const short = value => { const text = String(value || ''); return text.length > 18 ? `${text.slice(0, 7)}…${text.slice(-5)}` : text; };
const recordId = value => { const text = String(value ?? ''); return text.length > 16 ? text.slice(0, 8) : text; };
const labels = { MATCH: 'Match', MISMATCH: 'Mismatch', NOT_STATED: 'Not stated', COMPATIBLE: 'Compatible', INCOMPATIBLE: 'Incompatible', INCOMPLETE: 'Incomplete', SUBMITTED: 'Awaiting review', EVALUATED: 'Reviewed', OPEN: 'Open', SELECTED: 'Selected' };
const pill = (value, extra = '') => `<span class="pill ${String(value || 'neutral').toLowerCase().replace(/[^a-z_]/g, '')} ${extra}"><span class="pill-dot"></span>${esc(labels[value] || value || 'Not reviewed')}</span>`;
const request = () => state.requests.find(item => same(item.id, state.activeId));
const selectedOffer = () => state.offers.find(item => same(item.id, state.offerId));
const isBuyer = item => Boolean(state.wallet && item?.buyer && state.wallet.toLowerCase() === String(item.buyer).toLowerCase());
const writable = () => state.mode === 'live' && state.config.ready && state.wallet && !state.pending && !state.loading && !state.recoverable;
const canSelect = offer => writable() && isBuyer(request()) && request()?.status === 'OPEN' && offer?.status === 'EVALUATED' && offer.verdict === 'COMPATIBLE';
const disabled = condition => condition ? ' disabled' : '';
const isChosen = offer => request()?.status === 'SELECTED' && same(request()?.selected_offer_id, offer?.id);

function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function txUrl(hash, live = false) {
  const base = state.mode === 'recorded' && !live ? state.demo?.explorer || state.config.explorer : state.config.explorer;
  if (!base || !hash) return '';
  return safeUrl(String(base).includes('{hash}') ? String(base).replace('{hash}', encodeURIComponent(hash)) : `${String(base).replace(/\/$/, '')}/tx/${encodeURIComponent(hash)}`);
}
function txLink(hash, label = 'View transaction', live = false) {
  const url = txUrl(hash, live);
  return url ? `<a class="text-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon('link')}</a>` : hash ? `<span class="mono transaction-hash" title="${esc(hash)}">${esc(short(hash))}</span>` : '';
}
function errorMessage(error) {
  const text = String(error?.shortMessage || error?.message || error || 'The request could not be completed.');
  return text.length > 550 ? `${text.slice(0, 550)}…` : text;
}
function notice(message, kind = 'info') {
  state.notice = { message, kind };
  renderNotice();
}
function renderNotice() {
  const element = document.querySelector('#notice');
  if (!element) return;
  element.innerHTML = state.notice ? `<div class="notice ${esc(state.notice.kind)}" role="${state.notice.kind === 'error' ? 'alert' : 'status'}"><span>${esc(state.notice.message)}</span><button class="icon-button" data-action="dismiss-notice" aria-label="Dismiss notification">${icon('close')}</button></div>` : '';
}
function renderStatus() {
  const element = document.querySelector('#transaction-status');
  if (!element) return;
  const status = state.status;
  element.innerHTML = status ? `<div class="transaction-status ${state.pending ? 'working' : ''}" role="status" aria-live="polite"><div class="status-symbol">${state.pending ? '<span class="spinner"></span>' : icon(status.status === 'error' ? 'close' : 'check')}</div><div><strong>${state.pending ? 'Chain operation in progress' : status.status === 'error' ? 'Operation did not complete' : 'Latest chain operation'}</strong><p>${esc(status.message)}</p></div>${txLink(status.hash)}${!state.pending ? `<button class="icon-button" data-action="dismiss-status" aria-label="Dismiss transaction status">${icon('close')}</button>` : ''}</div>` : '';
  const modalStatus = document.querySelector('#modal-transaction-status');
  if (modalStatus) modalStatus.innerHTML = status && (state.pending || state.recoverable) ? `<strong>${state.pending ? 'Waiting for execution and read-back' : 'Transaction outcome needs checking'}</strong><p>${esc(status.message)}</p>${txLink(status.hash, 'View transaction', true)}${state.recoverable && !state.pending ? '<button type="button" class="button small secondary" data-action="resume-transaction">Resume pending transaction</button>' : ''}` : '';
}
function recoveryBanner() {
  const pending = state.recoverable;
  if (!pending || state.pending) return '';
  return `<div class="recovery-banner" role="status"><div><strong>A previous transaction still needs confirmation</strong><p>Check the existing transaction before submitting another. Resuming checks its execution and reads the stored result; it does not send a new transaction.</p>${txLink(pending.hash, 'Inspect pending transaction', true)}</div><button class="button secondary" data-action="${state.mode === 'live' ? 'resume-transaction' : 'mode-live'}">${state.mode === 'live' ? 'Resume pending transaction' : 'Switch to Live to resume'}</button></div>`;
}

function modeBanner() {
  if (state.mode === 'recorded') {
    const data = state.demo;
    const recorded = data?.recordedAt ? new Date(data.recordedAt) : null;
    const date = recorded && !Number.isNaN(recorded.getTime()) ? recorded.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : data?.recordedAt || '';
    return `<div class="mode-banner recorded-banner">${icon('layers')}<div><strong>Archived chain evidence</strong><span>Read-only records of verified contract interactions. This view does not make live network requests.${date ? ` Recorded ${esc(date)}.` : ''}</span></div><span class="subtle-tag">RECORDED DEMO</span></div>`;
  }
  if (!state.config.ready) return `<div class="mode-banner unavailable-banner">${icon('file')}<div><strong>Live contract is not configured</strong><span>Live actions will become available after a deployed contract is configured. You can inspect the recorded evidence now.</span></div><button class="button small secondary" data-action="mode-recorded">View recorded demo</button></div>`;
  return `<div class="mode-banner live-banner">${icon('lock')}<div><strong>Live workspace · ${esc(state.config.network || 'GenLayer')}</strong><span>Requirements and supplier text submitted here will be public on-chain. Use public or synthetic data only; exclude customer identities, contact details and confidential prices.</span></div><span class="subtle-tag">PUBLIC TEST DATA</span></div>`;
}

function render() {
  state.recoverable = pendingTransaction();
  app.innerHTML = `<header class="app-header"><a class="brand" href="#" aria-label="SpecCheck procurement workspace"><span class="brand-mark">S<span>c</span></span><span>SpecCheck<small>PROCUREMENT WORKSPACE</small></span></a><div class="header-actions"><span class="network-label"><span class="network-dot ${state.config.ready ? 'ready' : ''}"></span>${esc(state.config.network || 'GenLayer')}</span><button class="button wallet-button" data-action="connect"${disabled(state.pending)}>${icon('wallet')}<span>${state.wallet ? esc(short(state.wallet)) : 'Connect wallet'}</span></button></div></header>
  <main class="app-main"><div class="page-heading"><div><div class="eyebrow">SPECIFICATION REVIEW</div><h1>Procurement workspace</h1><p>Compare supplier statements with requirements recorded on-chain.</p></div><div class="mode-switch" role="group" aria-label="Workspace data source"><button data-action="mode-live" class="${state.mode === 'live' ? 'active' : ''}" aria-pressed="${state.mode === 'live'}"${disabled(state.pending)}><span class="live-dot"></span>Live</button><button data-action="mode-recorded" class="${state.mode === 'recorded' ? 'active' : ''}" aria-pressed="${state.mode === 'recorded'}"${disabled(state.pending)}>Recorded demo</button></div></div>
  ${modeBanner()}<div id="notice"></div><div id="transaction-status"></div>${recoveryBanner()}
  <div class="workspace"><aside class="requests-panel"><div class="panel-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h2>Requests <span class="count">${state.requests.length}</span></h2></div><button class="icon-button new-request-button" data-action="new-request" aria-label="Create a procurement request" title="${state.mode === 'recorded' ? 'Switch to Live to create a request' : 'Create a request'}"${disabled(!writable())}>${icon('plus')}</button></div><label class="search-field">${icon('search')}<input id="request-search" type="search" placeholder="Find a request" value="${esc(state.search)}" aria-label="Find a request" /></label><div id="request-list">${requestList()}</div><div class="sidebar-note">${icon('lock')}<p>Requirements stay fixed after creation.<br>New specification? Create a new request.</p></div></aside>
  <section class="detail-panel" aria-label="Selected procurement request">${state.loading ? loadingPanel() : request() ? requestDetail() : emptyWorkspace()}</section></div>
  <footer class="app-footer"><span>SpecCheck <span class="footer-separator">/</span> Evidence-based procurement review</span><p>Reviews text claims only. Does not verify physical goods, supplier identity or authenticity. No payments are made.</p><span class="footer-network">${state.mode === 'recorded' ? 'Archived evidence' : state.config.ready ? 'Live contract' : 'Contract not configured'}${state.config.address && state.mode === 'live' ? ` · <span class="mono" title="${esc(state.config.address)}">${esc(short(state.config.address))}</span>` : ''}</span></footer>
  </main>${renderModal()}`;
  renderNotice();
  renderStatus();
  if (state.modal) {
    const dialog = document.querySelector('#entry-dialog');
    dialog?.showModal();
    dialog?.addEventListener('cancel', event => { if (state.pending) event.preventDefault(); else { state.modal = null; } });
  }
}

function requestList() {
  if (state.loading && !state.requests.length) return '<div class="list-empty"><span class="spinner"></span><p>Loading requests…</p></div>';
  const filtered = state.requests.filter(item => `${item.title} ${item.id}`.toLowerCase().includes(state.search.toLowerCase()));
  if (!filtered.length) return `<div class="list-empty">${icon('file')}<p>${state.search ? 'No matching requests.' : 'No requests in this workspace yet.'}</p></div>`;
  return filtered.map(item => `<button class="request-card ${same(item.id, state.activeId) ? 'active' : ''}" data-action="open-request" data-id="${esc(item.id)}" aria-current="${same(item.id, state.activeId) ? 'true' : 'false'}"${disabled(state.pending)}><span class="request-card-top"><span class="mono">RFQ ${esc(recordId(item.id))}</span>${pill(item.status || 'OPEN')}</span><strong>${esc(item.title)}</strong><span class="request-card-bottom"><span>${item.requirements?.length || 0} requirements</span><span>${icon('arrow')}</span></span></button>`).join('');
}
function loadingPanel() {
  return '<div class="detail-loading" role="status"><span class="spinner"></span><h2>Loading workspace</h2><p>Reading requests and offer records…</p></div>';
}
function emptyWorkspace() {
  const recorded = state.mode === 'recorded';
  return `<div class="empty-workspace"><span class="empty-icon">${icon('file')}</span><span class="eyebrow">${recorded ? 'RECORDED DEMO' : 'GET STARTED'}</span><h2>${recorded ? 'No archived evidence is available yet' : 'Start with a clear specification'}</h2><p>${recorded ? 'Verified chain records will appear here when the evidence archive has been provided. No sample results are invented.' : 'Record a product and up to six requirements, then compare supplier text against the same fixed specification.'}</p>${!recorded ? `<button class="button primary" data-action="${state.wallet ? 'new-request' : 'connect'}"${disabled(!state.config.ready || state.pending)}>${icon(state.wallet ? 'plus' : 'wallet')}${state.wallet ? 'Create request' : 'Connect wallet to start'}</button>` : ''}</div>`;
}
function requestDetail() {
  const item = request();
  const offer = selectedOffer();
  const reviewed = state.offers.filter(entry => entry.status === 'EVALUATED').length;
  return `<div class="request-overview"><div class="request-title-row"><div><div class="request-kicker"><span class="mono">RFQ ${esc(recordId(item.id))}</span>${pill(item.status)}${state.mode === 'recorded' ? '<span class="archive-label">ARCHIVED RECORD</span>' : ''}</div><h2>${esc(item.title)}</h2><p class="request-owner">Buyer <span class="mono" title="${esc(item.buyer)}">${esc(short(item.buyer))}</span>${isBuyer(item) ? '<span class="you-label">You</span>' : ''}</p></div><button class="button primary" data-action="new-offer"${disabled(!writable() || item.status !== 'OPEN')}>${icon('plus')}Add supplier offer</button></div>
  <div class="requirements-box"><div class="section-label"><span>RECORDED REQUIREMENTS</span><span>${icon('lock')} Fixed for this request</span></div><ol class="requirements-list">${(item.requirements || []).map((value, index) => `<li><span class="requirement-number">${String(index + 1).padStart(2, '0')}</span><span>${esc(value)}</span></li>`).join('')}</ol></div>
  <div class="request-metrics"><span><strong>${state.offers.length}</strong> supplier ${state.offers.length === 1 ? 'offer' : 'offers'}</span><span><strong>${reviewed}</strong> reviewed</span><span><strong>${state.offers.filter(entry => entry.verdict === 'COMPATIBLE').length}</strong> compatible</span>${item.status === 'SELECTED' ? `<span class="selection-note">${icon('check')}Offer ${esc(recordId(item.selected_offer_id))} selected · request closed</span>` : ''}</div></div>
  <div class="review-navigation"><div class="view-tabs" role="group" aria-label="Offer view"><button class="${state.view === 'review' ? 'active' : ''}" data-action="view-review" aria-pressed="${state.view === 'review'}">Evidence review</button><button class="${state.view === 'compare' ? 'active' : ''}" data-action="view-compare" aria-pressed="${state.view === 'compare'}">Compare offers <span class="tab-count">${state.offers.length}</span></button></div>${state.mode === 'live' ? `<button class="button text-button" data-action="refresh"${disabled(state.pending || state.loading)}>Refresh records</button>` : '<span class="read-only-label">READ ONLY</span>'}</div>
  ${!state.offers.length ? noOffers() : state.view === 'compare' ? comparisonTable() : `${offerSwitcher()}${offer ? offerReview(offer) : ''}`}`;
}
function noOffers() {
  return `<div class="no-offers">${icon('layers')}<h3>No supplier offers yet</h3><p>Add the supplier's original quotation text. It will be preserved separately from the consensus review.</p>${state.mode === 'live' && !state.wallet ? '<button class="button secondary" data-action="connect">Connect wallet</button>' : ''}</div>`;
}
function offerSwitcher() {
  return `<div class="offer-switcher" role="group" aria-label="Choose an offer">${state.offers.map(offer => `<button class="offer-tab ${same(offer.id, state.offerId) ? 'active' : ''}" data-action="open-offer" data-id="${esc(offer.id)}"><span class="offer-tab-name">${esc(offer.supplier_label)}${isChosen(offer) ? icon('check') : ''}</span><span>${pill(offer.status === 'EVALUATED' ? offer.verdict : 'SUBMITTED')}</span></button>`).join('')}</div>`;
}
function requirementItem(offer, index) {
  const items = offer.items || [];
  return items.find(item => String(item.requirement_id) === String(index + 1)) || null;
}
function selectionButton(offer, compact = false) {
  if (isChosen(offer)) return `<span class="selected-confirmation">${icon('check')}Selected offer</span>`;
  if (state.mode !== 'live' || offer.verdict !== 'COMPATIBLE' || request()?.status !== 'OPEN') return '';
  const allowed = canSelect(offer);
  return `<button class="button ${compact ? 'small secondary' : 'secondary'}" data-action="select-offer" data-id="${esc(offer.id)}" title="${allowed ? 'Record this offer as the selected offer and close the request' : 'Only the buyer wallet can select a compatible offer'}"${disabled(!allowed)}>${icon('check')}Select offer</button>`;
}
function offerReview(offer) {
  const evaluated = offer.status === 'EVALUATED';
  const counts = (offer.items || []).reduce((map, item) => ({ ...map, [item.status]: (map[item.status] || 0) + 1 }), {});
  const outcomeDescriptions = {
    COMPATIBLE: 'Every recorded requirement is supported by the supplier text.',
    INCOMPATIBLE: 'At least one supplier statement conflicts with a recorded requirement.',
    INCOMPLETE: 'No explicit mismatch was recorded, but at least one requirement is not established by the text.',
  };
  return `<div class="offer-content"><div class="offer-heading"><div><div class="eyebrow">OFFER ${esc(recordId(offer.id))}</div><h3>${esc(offer.supplier_label)}</h3><p>Submitted by <span class="mono" title="${esc(offer.submitter)}">${esc(short(offer.submitter))}</span> <span class="source-label">User-supplied text</span></p></div><div class="offer-actions">${!evaluated ? `<button class="button primary" data-action="evaluate" data-id="${esc(offer.id)}" title="Only the buyer can run a consensus review"${disabled(!writable() || !isBuyer(request()) || request()?.status !== 'OPEN')}>${icon('layers')}Run consensus review</button>` : selectionButton(offer)}</div></div>
  ${evaluated ? `<div class="verdict-summary ${esc(String(offer.verdict || '').toLowerCase())}"><div><span class="section-label">CONSENSUS RESULT</span><h4>${esc(labels[offer.verdict] || offer.verdict)}</h4><p>${esc(outcomeDescriptions[offer.verdict] || 'Review the recorded per-requirement outcome below.')}</p></div><div class="verdict-counts"><span><strong>${counts.MATCH || 0}</strong>match</span><span><strong>${counts.MISMATCH || 0}</strong>mismatch</span><span><strong>${counts.NOT_STATED || 0}</strong>not stated</span></div></div>` : `<div class="awaiting-review"><span class="status-ring"></span><div><strong>Offer recorded. Review not yet run.</strong><p>The contract will evaluate the original text against each requirement. Validators independently check the decision before it is stored.</p></div></div>`}
  ${evaluated ? evidenceMatrix(offer) : ''}
  <details class="original-evidence" ${!evaluated ? 'open' : ''}><summary><span>${icon('file')}Original supplier text</span><span class="details-hint">Preserved as submitted <span class="chevron">⌄</span></span></summary><div class="original-evidence-body"><p class="evidence-disclosure">This is the submitter's quotation text; the submitter's identity is not proof of supplier authorship.</p><pre>${esc(offer.evidence)}</pre></div></details>
  <div class="evidence-provenance"><span>${icon('lock')} ${state.mode === 'recorded' ? 'Archived contract record' : 'Contract record'}${offer.digest ? ` <span class="mono" title="${esc(offer.digest)}">${esc(short(offer.digest))}</span>` : ''}</span>${txLink(offer.evaluation_hash || offer.transaction_hash || offer.tx_hash || offer.hash, 'Review transaction')}</div>
  ${request()?.status === 'OPEN' && state.mode === 'live' && evaluated && !isBuyer(request()) ? '<p class="action-help">Only the buyer wallet can select a compatible offer. Selection closes this request; it does not create a purchase or transfer funds.</p>' : ''}
  </div>`;
}
function evidenceMatrix(offer) {
  return `<div class="matrix-heading"><h4>Requirement evidence matrix</h4><span>${request().requirements.length} recorded checks</span></div><div class="table-scroll"><table class="evidence-table"><caption class="sr-only">Supplier statements and consensus decisions for each recorded requirement</caption><thead><tr><th scope="col">Requirement</th><th scope="col">Decision</th><th scope="col">Supplier quotation</th><th scope="col">Review reasoning</th></tr></thead><tbody>${request().requirements.map((requirement, index) => {
    const item = requirementItem(offer, index);
    return `<tr><th scope="row"><span class="table-index">${String(index + 1).padStart(2, '0')}</span>${esc(requirement)}</th><td>${item ? pill(item.status) : '<span class="muted">Record unavailable</span>'}</td><td>${item?.quote ? `<blockquote>${esc(item.quote)}</blockquote>` : '<span class="missing-evidence">No supporting quote recorded.</span>'}</td><td class="reason-cell">${esc(item?.reason || 'No review reasoning recorded.')}</td></tr>`;
  }).join('')}</tbody></table></div><p class="matrix-note">A quote is evidence of what the text states. It does not establish the actual condition, authenticity or performance of the goods.</p>`;
}
function comparisonTable() {
  return `<div class="comparison-content"><div class="matrix-heading"><div><h3>Supplier comparison</h3><p>Every offer is reviewed against the same fixed requirements.</p></div><span class="subtle-tag">${state.offers.length} OFFERS</span></div><div class="table-scroll"><table class="comparison-table"><caption class="sr-only">Side-by-side supplier offer comparison</caption><thead><tr><th scope="col">Recorded requirement</th>${state.offers.map(offer => `<th scope="col"><button class="supplier-link" data-action="open-offer" data-id="${esc(offer.id)}">${esc(offer.supplier_label)} ${icon('arrow')}</button><span class="comparison-offer-id">OFFER ${esc(recordId(offer.id))}</span>${isChosen(offer) ? '<span class="you-label">Selected</span>' : ''}</th>`).join('')}</tr></thead><tbody>${request().requirements.map((requirement, index) => `<tr><th scope="row"><span class="table-index">${String(index + 1).padStart(2, '0')}</span>${esc(requirement)}</th>${state.offers.map(offer => {
    const item = requirementItem(offer, index);
    return `<td>${item ? `${pill(item.status)}${item.quote ? `<p class="comparison-quote">“${esc(item.quote)}”</p>` : '<p class="comparison-quote muted">No supporting quote.</p>'}` : '<span class="muted">Awaiting review</span>'}</td>`;
  }).join('')}</tr>`).join('')}<tr class="comparison-verdict"><th scope="row">Overall result</th>${state.offers.map(offer => `<td>${pill(offer.status === 'EVALUATED' ? offer.verdict : 'SUBMITTED')}</td>`).join('')}</tr></tbody><tfoot><tr><th scope="row">${request()?.status === 'SELECTED' ? 'Recorded selection' : 'Buyer selection'}</th>${state.offers.map(offer => `<td>${selectionButton(offer, true) || '<span class="muted">—</span>'}</td>`).join('')}</tr></tfoot></table></div><p class="matrix-note">One mismatch makes an offer incompatible. Without mismatches, any missing or ambiguous requirement makes it incomplete. Only fully compatible offers can be selected.</p></div>`;
}

function renderModal() {
  if (!state.modal) return '';
  const isRequest = state.modal === 'request';
  const isSelection = state.modal === 'selection';
  if (isSelection) {
    const offer = state.offers.find(item => same(item.id, state.selectionId));
    return `<dialog id="entry-dialog" class="entry-dialog small-dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><div><span class="eyebrow">RECORD BUYER DECISION</span><h2 id="dialog-title">Select this offer?</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close"${disabled(state.pending)}>${icon('close')}</button></div><div class="dialog-body"><p class="selection-description"><strong>${esc(offer?.supplier_label)}</strong> will be recorded as the selected supplier offer for <strong>${esc(request()?.title)}</strong>.</p><div class="form-public-notice">${icon('lock')}<p>This closes the request. Existing offers remain available as history. No payment or purchase order is created.</p></div><div id="modal-transaction-status" class="modal-transaction-status" role="status" aria-live="polite"></div><div class="form-error" role="alert">${esc(state.formError)}</div></div><div class="dialog-footer"><button class="button secondary" data-action="close-modal"${disabled(state.pending)}>Cancel</button><button class="button primary" data-action="confirm-selection"${disabled(state.pending || Boolean(state.recoverable))}>${state.pending ? '<span class="spinner"></span>Recording selection…' : `${icon('check')}Confirm selection`}</button></div></dialog>`;
  }
  return `<dialog id="entry-dialog" class="entry-dialog" aria-labelledby="dialog-title"><form id="${isRequest ? 'request-form' : 'offer-form'}"><div class="dialog-heading"><div><span class="eyebrow">${isRequest ? 'NEW PROCUREMENT REQUEST' : `ADD OFFER · RFQ ${esc(recordId(state.activeId))}`}</span><h2 id="dialog-title">${isRequest ? 'Define your requirements' : 'Record a supplier offer'}</h2></div><button type="button" class="icon-button" data-action="close-modal" aria-label="Close"${disabled(state.pending)}>${icon('close')}</button></div><div class="dialog-body"><p class="form-intro">${isRequest ? 'Use one clear condition per line. Every requirement is mandatory and cannot be changed after submission.' : 'Paste the original quotation text. The contract reviews only what this evidence explicitly states.'}</p><div class="form-public-notice">${icon('lock')}<p><strong>Public on-chain submission.</strong> Use synthetic or already-public data. Do not include confidential quotations, customer details, private addresses or contact information.</p></div>
  ${isRequest ? `<label class="field-label" for="request-title">Request title</label><input class="form-input" id="request-title" name="title" required maxlength="160" placeholder="e.g. 24-port managed network switch" value="${esc(state.requestDraft.title)}"${disabled(state.pending)} /><div class="field-label-row"><label class="field-label">Mandatory requirements</label><span>1–6 requirements</span></div><div class="requirement-fields">${state.requestDraft.requirements.map((value, index) => `<div class="requirement-field"><span>${String(index + 1).padStart(2, '0')}</span><input class="form-input" data-requirement="${index}" aria-label="Requirement ${index + 1}" maxlength="500" required placeholder="${index === 0 ? 'e.g. At least 24 Gigabit Ethernet ports' : index === 1 ? 'e.g. Supports IEEE 802.3at PoE+' : 'One specific, verifiable condition'}" value="${esc(value)}"${disabled(state.pending)} /><button type="button" class="icon-button" data-action="remove-requirement" data-index="${index}" aria-label="Remove requirement ${index + 1}"${disabled(state.requestDraft.requirements.length <= 1 || state.pending)}>${icon('close')}</button></div>`).join('')}</div><button type="button" class="button text-button add-requirement" data-action="add-requirement"${disabled(state.requestDraft.requirements.length >= 6 || state.pending)}>${icon('plus')}Add requirement</button>` : `<label class="field-label" for="supplier-label">Supplier label</label><input class="form-input" id="supplier-label" name="supplier" required maxlength="120" placeholder="e.g. Supplier A — public sample" value="${esc(state.offerDraft.supplier)}"${disabled(state.pending)} /><label class="field-label" for="supplier-evidence">Original supplier text</label><textarea class="form-input evidence-input" id="supplier-evidence" name="evidence" rows="9" required maxlength="6000" placeholder="Paste the supplier's product specification and offer text here…"${disabled(state.pending)}>${esc(state.offerDraft.evidence)}</textarea><p class="field-help">Preserved exactly as submitted. Recording text does not verify its author or the goods.</p>`}
  <label class="public-acknowledgement"><input type="checkbox" name="publicAck" required${disabled(state.pending)} /><span>I understand that this text will be publicly visible and contains no confidential or personal information.</span></label><div id="modal-transaction-status" class="modal-transaction-status" role="status" aria-live="polite"></div><div class="form-error" role="alert">${esc(state.formError)}</div></div><div class="dialog-footer"><button type="button" class="button secondary" data-action="close-modal"${disabled(state.pending)}>Cancel</button><button type="submit" class="button primary"${disabled(state.pending || Boolean(state.recoverable))}>${state.pending ? '<span class="spinner"></span>Waiting for chain…' : `${icon(isRequest ? 'lock' : 'plus')}${isRequest ? 'Record requirements' : 'Record offer'}`}</button></div></form></dialog>`;
}

async function refreshData(preferredRequestId = state.activeId, preferredOfferId = state.offerId) {
  const epoch = ++state.detailEpoch;
  let requests;
  if (state.mode === 'recorded') requests = state.demo?.requests || [];
  else if (!state.config.ready) requests = [];
  else requests = await getRequests();
  if (epoch !== state.detailEpoch) return;
  state.requests = Array.isArray(requests) ? requests : [];
  state.activeId = state.requests.some(item => same(item.id, preferredRequestId)) ? preferredRequestId : state.requests[0]?.id ?? null;
  state.offers = [];
  if (state.activeId != null) {
    if (state.mode === 'recorded') state.offers = (state.demo?.offers || []).filter(item => same(item.request_id, state.activeId));
    else {
      const [detail, offers] = await Promise.all([getRequest(state.activeId), getOffers(state.activeId)]);
      if (epoch !== state.detailEpoch) return;
      if (detail) state.requests = state.requests.map(item => same(item.id, detail.id) ? detail : item);
      state.offers = Array.isArray(offers) ? offers : [];
    }
  }
  state.offerId = state.offers.some(item => same(item.id, preferredOfferId)) ? preferredOfferId : state.offers[0]?.id ?? null;
}
async function openRequest(id) {
  if (state.pending) return;
  state.activeId = id;
  state.offerId = null;
  state.loading = true;
  render();
  try { await refreshData(id, null); } catch (error) { notice(errorMessage(error), 'error'); }
  finally { state.loading = false; render(); }
}
async function setMode(mode) {
  if (state.pending || state.mode === mode) return;
  state.mode = mode;
  state.modal = null;
  state.notice = null;
  state.status = null;
  state.requests = [];
  state.offers = [];
  state.loading = true;
  state.search = '';
  render();
  try { await refreshData(null, null); } catch (error) { notice(`Could not read this workspace. ${errorMessage(error)}`, 'error'); }
  finally { state.loading = false; render(); }
}
async function connect() {
  if (state.pending) return;
  state.pending = true;
  render();
  try {
    state.wallet = await connectWallet();
    notice(`Wallet connected: ${short(state.wallet)}. ${state.mode === 'recorded' ? 'Switch to Live to submit a transaction.' : 'You can now submit public test data.'}`, 'success');
  } catch (error) { notice(`Wallet connection failed. ${errorMessage(error)}`, 'error'); }
  finally { state.pending = false; render(); }
}
async function transact(message, operation, readback) {
  if (!writable()) return;
  state.pending = true;
  state.formError = '';
  state.status = { message, status: 'pending', hash: '' };
  render();
  let result;
  try {
    result = await operation();
    state.status = { message: 'Transaction confirmed. Reading the updated contract record…', status: 'pending', hash: result?.hash || state.status?.hash || '' };
    renderStatus();
    await readback(result);
    state.modal = null;
    state.status = { message: 'Execution completed and the updated contract state was read back successfully.', status: 'success', hash: result?.hash || state.status?.hash || '' };
  } catch (error) {
    const message = errorMessage(error);
    state.formError = result ? `The transaction returned, but the follow-up read failed. Refresh records before trying again. ${message}` : message;
    state.status = { message: state.formError, status: 'error', hash: result?.hash || state.status?.hash || '' };
    if (!state.modal) notice(state.formError, 'error');
  } finally { state.pending = false; render(); }
}

async function resumeTransaction() {
  if (state.pending || state.mode !== 'live') return;
  const existing = pendingTransaction();
  if (!existing) { notice('There is no pending transaction to resume.', 'info'); render(); return; }
  state.pending = true;
  state.formError = '';
  state.status = { message: 'Checking the existing transaction. No new transaction is being sent…', status: 'pending', hash: existing.hash };
  render();
  try {
    const completed = await resumePendingTransaction();
    let requestId = state.activeId;
    let offerId = state.offerId;
    if (completed.method === 'create_request') { requestId = completed.args[0]; offerId = null; }
    if (completed.method === 'submit_offer') { requestId = completed.args[1]; offerId = completed.args[0]; }
    if (completed.method === 'select_offer') { requestId = completed.args[0]; offerId = completed.args[1]; }
    if (completed.method === 'evaluate_offer') {
      const offer = await getOffer(completed.args[0]);
      requestId = offer.request_id;
      offerId = offer.id;
    }
    await refreshData(requestId, offerId);
    state.modal = null;
    if (completed.method === 'create_request') state.requestDraft = { title: '', requirements: ['', '', ''] };
    if (completed.method === 'submit_offer') state.offerDraft = { supplier: '', evidence: '' };
    state.status = { message: 'The existing transaction completed successfully. Its execution and stored contract result were verified.', status: 'success', hash: completed.hash };
  } catch (error) {
    state.formError = errorMessage(error);
    state.status = { message: state.formError, status: 'error', hash: existing.hash };
    if (!state.modal) notice(state.formError, 'error');
  } finally { state.pending = false; render(); }
}

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'dismiss-notice') { state.notice = null; renderNotice(); return; }
  if (action === 'dismiss-status') { state.status = null; renderStatus(); return; }
  if (action === 'connect') return connect();
  if (action === 'resume-transaction') return resumeTransaction();
  if (action === 'mode-live' || action === 'mode-recorded') return setMode(action === 'mode-live' ? 'live' : 'recorded');
  if (action === 'open-request') return openRequest(button.dataset.id);
  if (action === 'open-offer') { state.offerId = button.dataset.id; state.view = 'review'; render(); return; }
  if (action === 'view-review' || action === 'view-compare') { state.view = action === 'view-review' ? 'review' : 'compare'; render(); return; }
  if (action === 'close-modal') { if (!state.pending) { state.modal = null; render(); } return; }
  if (action === 'new-request' || action === 'new-offer') {
    if (!writable()) return;
    state.modal = action === 'new-request' ? 'request' : 'offer';
    state.formError = '';
    render();
    return;
  }
  if (action === 'add-requirement') {
    if (state.requestDraft.requirements.length < 6) { state.requestDraft.requirements.push(''); render(); document.querySelector(`[data-requirement="${state.requestDraft.requirements.length - 1}"]`)?.focus(); }
    return;
  }
  if (action === 'remove-requirement') {
    if (state.requestDraft.requirements.length > 1) { state.requestDraft.requirements.splice(Number(button.dataset.index), 1); render(); }
    return;
  }
  if (action === 'refresh') {
    state.loading = true; render();
    try { await refreshData(); notice('Contract records refreshed.', 'success'); } catch (error) { notice(errorMessage(error), 'error'); }
    finally { state.loading = false; render(); }
    return;
  }
  if (action === 'evaluate') {
    const id = button.dataset.id;
    if (request()?.status !== 'OPEN' || !isBuyer(request())) return;
    return transact('Waiting for wallet confirmation to run the consensus review…', () => evaluateOffer(id), () => refreshData(state.activeId, id));
  }
  if (action === 'select-offer') {
    const offer = state.offers.find(item => same(item.id, button.dataset.id));
    if (!canSelect(offer)) return;
    state.selectionId = offer.id; state.modal = 'selection'; state.formError = ''; render();
    return;
  }
  if (action === 'confirm-selection') {
    const offer = state.offers.find(item => same(item.id, state.selectionId));
    if (!canSelect(offer)) return;
    return transact('Waiting for wallet confirmation to record the selected offer…', () => selectOffer(state.activeId, offer.id), () => refreshData(state.activeId, offer.id));
  }
});
app.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'request-search') { state.search = target.value; const list = document.querySelector('#request-list'); if (list) list.innerHTML = requestList(); }
  if (target.id === 'request-title') state.requestDraft.title = target.value;
  if (target.dataset.requirement != null) state.requestDraft.requirements[Number(target.dataset.requirement)] = target.value;
  if (target.id === 'supplier-label') state.offerDraft.supplier = target.value;
  if (target.id === 'supplier-evidence') state.offerDraft.evidence = target.value;
});
app.addEventListener('submit', async event => {
  event.preventDefault();
  if (!writable()) return;
  if (event.target.id === 'request-form') {
    const title = state.requestDraft.title.trim();
    const requirements = state.requestDraft.requirements.map(value => value.trim());
    if (!title || requirements.some(value => !value)) return;
    return transact('Waiting for wallet confirmation to record the requirements…', () => createRequest(title, requirements), async result => {
      await refreshData(result?.id, null);
      state.requestDraft = { title: '', requirements: ['', '', ''] };
    });
  }
  if (event.target.id === 'offer-form') {
    const supplier = state.offerDraft.supplier.trim();
    const evidence = state.offerDraft.evidence;
    if (!supplier || !evidence.trim() || request()?.status !== 'OPEN') return;
    return transact('Waiting for wallet confirmation to preserve the supplier offer…', () => submitOffer(state.activeId, supplier, evidence), async result => {
      await refreshData(state.activeId, result?.id);
      state.offerDraft = { supplier: '', evidence: '' };
      state.view = 'review';
    });
  }
});

onStatus(update => {
  const value = typeof update === 'string' ? { message: update } : update || {};
  state.status = { ...state.status, ...value, message: value.message || state.status?.message || 'Waiting for the chain…' };
  renderStatus();
});
if (window.ethereum?.on) {
  window.ethereum.on('accountsChanged', accounts => {
    const next = accounts[0] || '';
    if (state.wallet && next.toLowerCase() !== state.wallet.toLowerCase()) {
      state.wallet = '';
      notice('The wallet account changed. Reconnect to use the newly selected account.', 'info');
    }
    if (!state.pending) render();
  });
  window.ethereum.on('chainChanged', () => {
    notice('Wallet network changed. Live transactions will check the configured GenLayer network.', 'info');
  });
}

async function init() {
  render();
  try {
    state.config = await getConfig();
    try {
      const data = await loadDemoEvidence();
      state.demo = data || { requests: [], offers: [] };
      if (!Array.isArray(state.demo.requests)) state.demo.requests = [];
      if (!Array.isArray(state.demo.offers)) state.demo.offers = [];
    } catch (error) {
      state.demo = { requests: [], offers: [] };
      notice(`Archived evidence could not be loaded. ${errorMessage(error)}`, 'error');
    }
    await refreshData(null, null);
  } catch (error) { notice(`Workspace initialization failed. ${errorMessage(error)}`, 'error'); }
  finally { state.loading = false; render(); }
}
init();
