import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../Components/notif/Topbar';
import './Transaction.css';

const TAB_STATUSES = {
  Pending:   ['reserved', 'overdue'],
  Completed: ['to ship', 'shipped out', 'completed'],
  Cancelled: [],
  Return:    ['returning', 'exchanged', 'reshipped', 'return', 'cancelled'],
};

const STATUS_META = {
  reserved:      { label: 'reserved',    bg: 'rgba(253,230,138,0.25)', border: 'rgba(253,230,138,0.63)', dot: '#FDE68A' },
  overdue:       { label: 'overdue',     bg: 'rgba(252,165,165,0.25)', border: 'rgba(252,165,165,0.66)', dot: '#FCA5A5' },
  'to ship':     { label: 'to ship',     bg: 'rgba(147,197,253,0.25)', border: 'rgba(147,197,253,0.66)', dot: '#93C5FD' },
  'shipped out': { label: 'shipped out', bg: 'rgba(196,181,253,0.25)', border: 'rgba(196,181,253,0.66)', dot: '#C4B5FD' },
  completed:     { label: 'completed',   bg: 'rgba(112,233,90,0.25)',  border: 'rgba(112,233,90,0.66)',  dot: '#70E95A' },
  cancelled:     { label: 'cancelled',   bg: 'rgba(153,2,20,0.25)',    border: '#990214',                dot: '#990214' },
  returning:     { label: 'returning',   bg: 'rgba(139,69,19,0.25)',   border: 'rgba(139,69,19,0.66)',   dot: '#8B4513' },
  exchanged:     { label: 'exchanged',   bg: 'rgba(128,128,128,0.25)', border: 'rgba(128,128,128,0.66)', dot: '#808080' },
  reshipped:     { label: 'reshipped',   bg: 'rgba(0,128,128,0.25)',   border: 'rgba(0,128,128,0.66)',   dot: '#008080' },
  return:        { label: 'return',      bg: 'rgba(64,224,208,0.25)',  border: 'rgba(64,224,208,0.66)',  dot: '#40E0D0' },
};

// ─── Invoice Financial Calculator ─────────────────────────────────────────────
// Computes the correct Sub Total, Total Amount, and a label describing the
// financial meaning based on the return status.
//
// Status rules:
//   returning / cancelled / reshipped → all zeros (no financial event yet / no change)
//   return     → refund: sum of returned items (price × returnQuantity)
//   exchanged  → difference: replacementTotal − returnedTotal
//                positive = customer owes more, negative = store refunds customer
//   (non-return orders) → use raw subTotal from the order

function computeInvoiceFinancials(txn, isReturnMode) {
  if (!isReturnMode) {
    const subTotal = txn?._raw?.subTotal || 0;
    return { subTotal, totalAmount: subTotal, totalLabel: 'Total Amount', totalNote: null };
  }

  const status      = txn?._raw?.status?.toLowerCase() || '';
  const returnItems = txn?._raw?.returnItems || [];

  // Zero-value statuses
  if (['returning', 'cancelled', 'reshipped'].includes(status)) {
    return { subTotal: 0, totalAmount: 0, totalLabel: 'Total Amount', totalNote: 'No financial transaction' };
  }

  // Return status → refund the customer for returned items
  if (status === 'return') {
    const subTotal = returnItems.reduce((sum, i) => sum + (i.price ?? 0) * (i.returnQuantity ?? 0), 0);
    return { subTotal, totalAmount: subTotal, totalLabel: 'Refund Amount', totalNote: 'Customer refund' };
  }

  // Exchanged status → show difference between replacement and returned value
  if (status === 'exchanged') {
    const returnedTotal     = returnItems.reduce((sum, i) => sum + (i.price ?? 0) * (i.returnQuantity ?? 0), 0);
    const replacementTotal  = returnItems.reduce((sum, i) => {
      const replPrice = i.replacementPrice ?? i.replacementProduct?.wholesalePrice ?? i.replacementProduct?.retailPrice ?? 0;
      const replQty   = i.replacementQuantity ?? i.returnQuantity ?? 0;
      return sum + replPrice * replQty;
    }, 0);
    const diff = replacementTotal - returnedTotal;

    let totalLabel, totalNote;
    if (diff > 0) {
      totalLabel = 'Amount to Collect';
      totalNote  = 'Customer owes additional amount';
    } else if (diff < 0) {
      totalLabel = 'Refund Amount';
      totalNote  = 'Refund difference to customer';
    } else {
      totalLabel = 'Total Amount';
      totalNote  = 'Even exchange — no payment needed';
    }

    return { subTotal: returnedTotal, replacementTotal, totalAmount: Math.abs(diff), totalLabel, totalNote, diff };
  }

  // Fallback (should not reach here)
  return { subTotal: 0, totalAmount: 0, totalLabel: 'Total Amount', totalNote: null };
}

// ─── Alert Modal ──────────────────────────────────────────────────────────────

const ALERT_META = {
  success: { icon: 'check',   iconColor: '#3DB82B', circleBg: 'rgba(112,233,90,0.15)', circleBorder: 'rgba(112,233,90,0.45)', btnBg: '#3DB82B' },
  error:   { icon: 'close',   iconColor: '#c0392b', circleBg: 'rgba(192,57,43,0.10)',  circleBorder: 'rgba(192,57,43,0.35)', btnBg: '#c0392b' },
  warning: { icon: 'warning', iconColor: '#e67e22', circleBg: 'rgba(230,126,34,0.10)', circleBorder: 'rgba(230,126,34,0.35)', btnBg: '#e67e22' },
};

function AlertModal({ type, title, message, btnLabel = 'OK', onClose }) {
  if (!type) return null;
  const meta = ALERT_META[type] || ALERT_META.error;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:'36px 32px 28px', width:'100%', maxWidth:420, textAlign:'center', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:meta.circleBg, border:`2px solid ${meta.circleBorder}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <span className="material-icons" style={{ fontSize:36, color:meta.iconColor }}>{meta.icon}</span>
        </div>
        <h2 style={{ margin:'0 0 8px', fontFamily:'Inter,sans-serif', fontWeight:800, fontSize:22, color:'#000' }}>{title}</h2>
        <p style={{ margin:'0 0 24px', fontFamily:'Inter,sans-serif', fontWeight:400, fontSize:13, color:'rgba(0,0,0,0.55)', lineHeight:1.6 }}>{message}</p>
        <button onClick={onClose} style={{ height:40, padding:'0 32px', background:meta.btnBg, color:'#fff', border:'none', borderRadius:8, fontFamily:'Inter,sans-serif', fontWeight:700, fontSize:14, cursor:'pointer' }}>
          {btnLabel}
        </button>
      </div>
    </div>
  );
}

function useAlert() {
  const [alertModal, setAlertModal] = useState(null);
  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({ type, title, message, btnLabel, onClose: onClose ?? (() => setAlertModal(null)) });
  };
  const AlertRenderer = alertModal ? (
    <AlertModal type={alertModal.type} title={alertModal.title} message={alertModal.message} btnLabel={alertModal.btnLabel} onClose={alertModal.onClose} />
  ) : null;
  return { showAlert, AlertRenderer, setAlertModal };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.reserved;
  return (
    <span className="txn__badge" style={{ background: m.bg, border: `0.5px solid ${m.border}` }}>
      <span className="txn__badge-dot" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

// ─── Invoice Print HTML ───────────────────────────────────────────────────────

function generateInvoicePrintHTML(txn, items, isReturnMode) {
  const { subTotal, replacementTotal, totalAmount, totalLabel, totalNote, diff } =
    computeInvoiceFinancials(txn, isReturnMode);

  const rows = items.map((item) => {
    const qty       = isReturnMode ? (item.returnQuantity ?? 0) : (item.quantity ?? 0);
    const price     = item.price ?? 0;
    const replName  = item.replacementName || item.replacementProduct?.name || null;
    const replPrice = item.replacementPrice ?? item.replacementProduct?.wholesalePrice ?? item.replacementProduct?.retailPrice ?? 0;
    const replQty   = item.replacementQuantity ?? qty;
    return `<tr>
      <td>
        <div style="font-weight:700;font-size:9px">${item.name}</div>
        ${item.reason ? `<div style="font-size:8px;color:rgba(0,0,0,0.45)">Reason: ${item.reason}</div>` : ''}
        ${replName ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(0,0,0,0.12)">
          <div style="font-size:8px;color:rgba(0,0,0,0.4);margin-bottom:2px">↳ Replacement:</div>
          <div style="font-weight:700;font-size:9px;color:#8B333D">${replName}</div>
          <div style="font-size:8px;color:rgba(0,0,0,0.45)">x${replQty} &nbsp;·&nbsp; P ${replPrice.toLocaleString()}.00</div>
        </div>` : ''}
      </td>
      <td>${qty}</td><td>P ${price.toLocaleString()}.00</td><td>P ${(price*qty).toLocaleString()}.00</td>
      <td>0</td><td>0</td><td>P ${(price*qty).toLocaleString()}.00</td>
    </tr>`;
  }).join('');

  // Build summary rows depending on mode
  const summaryRows = isReturnMode ? `
    <div style="display:flex;gap:20px;font-size:9px"><span style="font-weight:600;min-width:120px;text-align:right">Returned Items Total:</span><span>P ${subTotal.toLocaleString()}.00</span></div>
    ${replacementTotal != null ? `<div style="display:flex;gap:20px;font-size:9px"><span style="font-weight:600;min-width:120px;text-align:right">Replacement Total:</span><span>P ${replacementTotal.toLocaleString()}.00</span></div>` : ''}
    <div style="display:flex;gap:20px;font-size:9px"><span style="font-weight:600;min-width:120px;text-align:right">VAT Tax:</span><span>P 0.00</span></div>
    <div style="display:flex;gap:20px;font-size:12px;font-weight:800;color:#8B333D">
      <span>${totalLabel}${diff != null && diff !== 0 ? (diff > 0 ? ' (+)' : ' (−)') : ''}:</span>
      <span>P ${totalAmount.toLocaleString()}.00</span>
    </div>
    ${totalNote ? `<div style="font-size:8px;color:rgba(0,0,0,0.4);text-align:right;margin-top:2px">${totalNote}</div>` : ''}
  ` : `
    <div style="display:flex;gap:20px;font-size:9px"><span style="font-weight:600;min-width:80px;text-align:right">Sub Total:</span><span>P ${subTotal.toLocaleString()}.00</span></div>
    <div style="display:flex;gap:20px;font-size:9px"><span style="font-weight:600;min-width:80px;text-align:right">Vat Tax:</span><span>P 0.00</span></div>
    <div style="display:flex;gap:20px;font-size:12px;font-weight:800;color:#8B333D"><span>Total Amount:</span><span>P ${subTotal.toLocaleString()}.00</span></div>
  `;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;padding:28px}
.hdr{display:flex;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1.5px solid #8B333D}
.brand{font-weight:800;font-size:18px;color:#8B333D;margin-bottom:6px}.addr{font-size:8px;color:rgba(0,0,0,0.5);line-height:1.6}
.inv-title{font-size:26px;font-weight:700;color:rgba(0,0,0,0.3);text-align:right}
.meta{font-size:9px;text-align:right;line-height:1.8}table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:14px}
thead tr{background:#FFF28D}th{padding:6px 8px;font-weight:700;text-align:left;border-bottom:1px solid #ddd}
td{padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.05);vertical-align:top}
.footer{text-align:center;font-size:7px;color:rgba(0,0,0,0.4);border-top:1px solid #eee;padding-top:10px;margin-top:16px}
@media print{html,body{height:auto}}</style></head>
<body><div class="hdr"><div><div class="brand">LOVE ATHALIA</div>
<div class="addr">Blk 15 Lot 4 Ph 4 Pkg 2 Barangay 176 Bagong Silang 1400<br/>City of Caloocan NCR, Third District Philippines<br/>Shane Anne C. Gapas - Prop.<br/>Non VAT- Reg Tin: 425-464-696-000000</div></div>
<div><div class="inv-title">INVOICE</div>
<div class="meta"><b>Invoice no:</b> ${txn?.id?.slice(-8)||'—'}<br/><b>Date Issued:</b> ${txn?.date||'—'}<br/><b>Ref:</b> ${txn?.ref||'—'}</div></div></div>
<p style="font-weight:700;font-size:11px;margin-bottom:8px">${isReturnMode?'Return / Exchange Details:':'Order Details:'}</p>
<table><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Tax</th><th>Discount</th><th>Amount</th></tr></thead>
<tbody>${rows}</tbody></table>
<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;margin-bottom:14px">
${summaryRows}
</div>
<div class="footer">BIR Permit No. OCN 027 AU2024000002225</div></body></html>`;
}

// ─── Customer Info Panel ──────────────────────────────────────────────────────

function CustomerInfoPanel({ txn, onConfirmPayment, onClose, onEdit, onCancel, readOnly = false }) {
  const items    = txn?._raw?.products || [];
  const subTotal = txn?._raw?.subTotal || 0;
  return (
    <div className="custinfo">
      <button className="panel__close-x" onClick={onClose} title="Close">
        <span className="material-icons" style={{ fontSize:16 }}>close</span>
      </button>
      <div className="custinfo__scroll-body">
        <h2 className="custinfo__title">Customer Information</h2>
        <div className="custinfo__meta-section">
          <div className="custinfo__meta-row">
            <span className="custinfo__label">Transaction ID:</span>
            <span className="custinfo__value custinfo__value--muted">{txn?.id?.slice(-8)}</span>
            <span className="custinfo__label" style={{ marginLeft:'auto' }}>Date of order:</span>
            <span className="custinfo__value custinfo__value--muted">{txn?.date}</span>
          </div>
          <div className="custinfo__meta-row">
            <span className="custinfo__label">Customer Name:</span>
            <span className="custinfo__value">{txn?.customer}</span>
          </div>
          <div className="custinfo__meta-row">
            <span className="custinfo__label">Payment Method:</span>
            <span className="custinfo__value">{txn?.method}</span>
          </div>
          {readOnly && (
            <div className="custinfo__meta-row">
              <span className="custinfo__label">Status:</span>
              <span><StatusBadge status={txn?.status} /></span>
            </div>
          )}
        </div>
        <h3 className="custinfo__section-title">Order Details</h3>
        <div className="custinfo__items-list">
          {items.length === 0 ? (
            <p style={{ fontSize:12, color:'rgba(0,0,0,0.4)', padding:'12px 0' }}>No items found.</p>
          ) : items.map((item, i) => (
            <div key={i} className="custinfo__item-card">
              <div className="custinfo__item-img">
              {item.product?.images?.[0]
                ? <img
                    src={item.product.images[0]}
                    alt={item.name}
                    style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:6 }}
                  />
                : <span className="material-icons" style={{ fontSize:28, color:'rgba(0,0,0,0.18)' }}>inventory_2</span>
              }
            </div>
              <div className="custinfo__item-info">
                <div className="custinfo__item-name">{item.name}</div>
                <div className="custinfo__item-footer">
                  <span className="custinfo__item-unit-price">P {(item.price??0).toLocaleString()}.00</span>
                  <span className="custinfo__item-qty">{item.quantity} pack</span>
                </div>
              </div>
              <div className="custinfo__item-amount">P {((item.price??0)*item.quantity).toLocaleString()}.00</div>
            </div>
          ))}
        </div>
        <h3 className="custinfo__section-title">Order Summary</h3>
        <div className="custinfo__summary-box">
          <div className="custinfo__sum-row"><span>Sub Total</span><span>P {subTotal.toLocaleString()}.00</span></div>
          <div className="custinfo__sum-row"><span>Tax</span><span>P0.00</span></div>
          <div className="custinfo__sum-row"><span>Discount</span><span>P0.00</span></div>
          <div className="custinfo__sum-divider" />
          <div className="custinfo__sum-total-row">
            <span className="custinfo__sum-total-label">TOTAL AMOUNT</span>
            <span className="custinfo__sum-total-val">P {subTotal.toLocaleString()}.00</span>
          </div>
        </div>
      </div>
      {!readOnly && (
        <div className="custinfo__actions">
          <button className="custinfo__btn--edit" onClick={onCancel}>Cancel</button>
          <button className="custinfo__btn--confirm" onClick={onConfirmPayment}>Confirm Payment</button>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Panel ────────────────────────────────────────────────────────────

function InvoicePanel({ txn, onReturn, onConfirmShipment, onConfirmComplete, onClose, isReturnMode=false, onReturnProduct, onPostReturn, onCancel, onCancelReturn, onEditExchange, onEditShipment }) {
  const items = isReturnMode ? (txn?._raw?.returnItems||[]) : (txn?._raw?.products||[]);

  // ── Use the financial calculator instead of raw subTotal ──
  const { subTotal, replacementTotal, totalAmount, totalLabel, totalNote, diff } =
    computeInvoiceFinancials(txn, isReturnMode);

  const canReturn        = !isReturnMode && txn?.status === 'completed';
  const canShip          = !isReturnMode && txn?.status === 'to ship';
  const canComplete      = !isReturnMode && txn?.status === 'shipped out';
  const canEditShipment  = !isReturnMode && txn?.status === 'shipped out';
  const canReturnProduct = isReturnMode  && txn?.status === 'returning';
  const canReshipProduct = isReturnMode  && txn?.status === 'exchanged';
  const canCancel        = !isReturnMode && txn?.status === 'to ship';
  const canPostReturn    = isReturnMode  && txn?.status === 'return';
  const canCancelReturn  = isReturnMode  && txn?.status === 'returning';
  const canEditExchange  = isReturnMode  && txn?.status === 'exchanged';

  const handlePrint = () => {
    const html = generateInvoicePrintHTML(txn, items, isReturnMode);
    const pw = window.open('', '_blank', 'width=900,height=750');
    if (!pw) return;
    pw.document.write(html); pw.document.close();
    pw.onload = () => { pw.focus(); pw.print(); };
  };

  const handleDownload = () => {
    const html = generateInvoicePrintHTML(txn, items, isReturnMode);
    const blob = new Blob([html], { type:'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `invoice-${txn?.id?.slice(-8)||'order'}.html`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="invoice">
      <button className="panel__close-x" onClick={onClose} title="Close">
        <span className="material-icons" style={{ fontSize:16 }}>close</span>
      </button>
      <div className="invoice__scroll-body">
        <div className="invoice__head">
          <div className="invoice__logo-wrap">
            <img src="/images/logo.png" alt="Love Athalia" className="invoice__logo" onError={(e)=>(e.target.style.display='none')} />
          </div>
          <div className="invoice__head-right">
            <p className="invoice__title-text">INVOICE</p>
            <div className="invoice__meta-row"><span className="invoice__meta-label">Invoice no:</span><span className="invoice__meta-val">{txn?.id?.slice(-8)}</span></div>
            <div className="invoice__meta-row"><span className="invoice__meta-label">Date Issued:</span><span className="invoice__meta-val" style={{ color:'rgba(0,0,0,0.51)' }}>{txn?.date}</span></div>
            <div className="invoice__meta-row"><span className="invoice__meta-label">Ref:</span><span className="invoice__meta-val" style={{ color:'rgba(0,0,0,0.51)' }}>{txn?.ref||'—'}</span></div>
          </div>
        </div>
        <div className="invoice__address">
          <p>Blk 15 Lot 4 Ph 4 Pkg 2 Barangay 176 Bagong Silang 1400</p>
          <p>City of Caloocan NCR, Third District Philippines</p>
          <p>Shane Anne C. Gapas - Prop.</p>
          <p>Non VAT- Reg Tin: 425-464-696-000000</p>
        </div>
        <div className="invoice__customer">
          <div className="invoice__customer-row">
            <span className="invoice__cust-label">Customer Name:</span>
            <span className="invoice__cust-val">{txn?.customer}</span>
          </div>
          <div className="invoice__customer-row">
            <span className="invoice__cust-label invoice__cust-label--sm">Transaction ID:</span>
            <span className="invoice__cust-val invoice__cust-val--sm">{txn?.id?.slice(-8)}</span>
            <span className="invoice__cust-label invoice__cust-label--sm" style={{ marginLeft:10 }}>
              {isReturnMode ? 'Return Type:' : 'Payment Method:'}
            </span>
            <span className="invoice__cust-val invoice__cust-val--sm" style={{ textTransform:'capitalize' }}>
              {isReturnMode ? (txn?._raw?.returnType||'—') : txn?.method}
            </span>
          </div>
          <div className="invoice__customer-row">
            <span className="invoice__cust-label invoice__cust-label--sm">
              {isReturnMode ? 'Date of Return:' : 'Date Order:'}
            </span>
            <span className="invoice__cust-val invoice__cust-val--sm" style={{ color:'rgba(0,0,0,0.55)' }}>{txn?.date}</span>
            {!isReturnMode && <>
              <span className="invoice__cust-label invoice__cust-label--sm" style={{ marginLeft:10 }}>Payment Reference:</span>
              <span className="invoice__cust-val invoice__cust-val--sm">{txn?.ref||'—'}</span>
            </>}
            {isReturnMode && <>
              <span className="invoice__cust-label invoice__cust-label--sm" style={{ marginLeft:10 }}>Status:</span>
              <span className="invoice__cust-val invoice__cust-val--sm"><StatusBadge status={txn?.status} /></span>
            </>}
          </div>
        </div>
        <p className="invoice__section-label">{isReturnMode ? 'Return / Exchange Details:' : 'Order Details:'}</p>
        <div className="invoice__items-scroll">
          <table className="invoice__items-table">
            <thead>
              <tr className="invoice__items-head">
                <th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Tax</th><th>Discount</th><th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:16, color:'rgba(0,0,0,0.35)', fontSize:12 }}>No items found.</td></tr>
              ) : items.map((item, i) => {
                const qty       = isReturnMode ? (item.returnQuantity??0) : (item.quantity??0);
                const price     = item.price ?? 0;
                const replName  = item.replacementName || item.replacementProduct?.name || null;
                const replPrice = item.replacementPrice ?? item.replacementProduct?.wholesalePrice ?? item.replacementProduct?.retailPrice ?? 0;
                const replQty   = item.replacementQuantity ?? qty;
                return (
                  <tr key={i} className="invoice__item-row">
                    <td>
                      <span className="invoice__item-name">{item.name}</span>
                      {item.reason && <span style={{ fontSize:10, color:'rgba(0,0,0,0.45)', display:'block', marginTop:2 }}>Reason: {item.reason}</span>}
                      {replName && (
                        <div style={{ marginTop:6, paddingTop:6, borderTop:'1px dashed rgba(0,0,0,0.12)' }}>
                          <span style={{ fontSize:10, color:'rgba(0,0,0,0.4)', display:'block', marginBottom:2 }}>↳ Replacement:</span>
                          <span style={{ fontWeight:700, fontSize:11, color:'#8B333D', display:'block' }}>{replName}</span>
                          <span style={{ fontSize:10, color:'rgba(0,0,0,0.5)', display:'block' }}>x{replQty} &nbsp;·&nbsp; P {replPrice.toLocaleString()}.00</span>
                        </div>
                      )}
                    </td>
                    <td>{qty}</td>
                    <td>P {price.toLocaleString()}.00</td>
                    <td>P {(price*qty).toLocaleString()}.00</td>
                    <td>0</td><td>0</td>
                    <td>P {(price*qty).toLocaleString()}.00</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Status-aware summary section ── */}
        <div className="invoice__summary">
          {isReturnMode ? (
            <>
              <div className="invoice__sum-row">
                <span>Returned Items Total:</span>
                <span>P {subTotal.toLocaleString()}.00</span>
              </div>
              {replacementTotal != null && (
                <div className="invoice__sum-row">
                  <span>Replacement Total:</span>
                  <span>P {replacementTotal.toLocaleString()}.00</span>
                </div>
              )}
              <div className="invoice__sum-row"><span>VAT Tax:</span><span>P 0.00</span></div>
              <div className="invoice__sum-row"><span>Discount:</span><span>P 0.00</span></div>
              <div className="invoice__sum-divider" />
              <div className="invoice__sum-total">
                <span>
                  {totalLabel}
                  {diff != null && diff > 0 && <span style={{ fontSize:10, color:'rgba(0,0,0,0.4)', marginLeft:4 }}>(customer pays)</span>}
                  {diff != null && diff < 0 && <span style={{ fontSize:10, color:'rgba(0,0,0,0.4)', marginLeft:4 }}>(store refunds)</span>}
                  {' '}:
                </span>
                <span style={{ color: diff != null && diff < 0 ? '#1a7a4a' : '#8B333D' }}>
                  P {totalAmount.toLocaleString()}.00
                </span>
              </div>
              {totalNote && (
                <div style={{ textAlign:'right', fontSize:10, color:'rgba(0,0,0,0.4)', marginTop:4, fontStyle:'italic' }}>
                  {totalNote}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="invoice__sum-row"><span>Sub Total:</span><span>P {subTotal.toLocaleString()}.00</span></div>
              <div className="invoice__sum-row"><span>Vat Tax:</span><span>P 0.00</span></div>
              <div className="invoice__sum-row"><span>Discount:</span><span>P 0.00</span></div>
              <div className="invoice__sum-divider" />
              <div className="invoice__sum-total">
                <span>Total Amount :</span>
                <span style={{ color:'#8B333D' }}>P {subTotal.toLocaleString()}.00</span>
              </div>
            </>
          )}
        </div>

        <div className="invoice__footer-logo">
          <img src="/images/logo.png" alt="" style={{ height:24 }} onError={(e)=>(e.target.style.display='none')} />
        </div>
        <p className="invoice__bir">BIR Permit No. OCN 027 AU2024000002225</p>
      </div>

      <div className="invoice__actions">
        {canReturn        && <button className="invoice__act-btn invoice__act-btn--return" onClick={onReturn}>Request Return</button>}
        {canShip          && (
          <button className="invoice__act-btn invoice__act-btn--ship" onClick={onConfirmShipment}>
            <span className="material-icons" style={{ fontSize:15, marginRight:4 }}>local_shipping</span>Confirm Shipment
          </button>
        )}
        {canCancel        && (
          <button className="invoice__act-btn invoice__act-btn--cancel-order" onClick={onCancel}>
            <span className="material-icons" style={{ fontSize:15, marginRight:4 }}>cancel</span>Cancel Order
          </button>
        )}
        {canComplete      && (
          <button className="invoice__act-btn invoice__act-btn--complete" onClick={onConfirmComplete}>
            <span className="material-icons" style={{ fontSize:15, marginRight:4 }}>check_circle</span>Mark as Completed
          </button>
        )}
        {canReturnProduct && <button className="invoice__act-btn invoice__act-btn--return-product" onClick={onReturnProduct}>Confirm Received</button>}
        {canReshipProduct && <button className="invoice__act-btn invoice__act-btn--reship-product" onClick={onPostReturn}>Confirm Reshipped</button>}
        {canPostReturn    && <button className="invoice__act-btn invoice__act-btn--reship-product" onClick={onPostReturn}>Process Return</button>}
        {canCancelReturn  && (
          <button className="invoice__act-btn invoice__act-btn--cancel-order" onClick={onCancelReturn}>
            <span className="material-icons" style={{ fontSize:15, marginRight:4 }}>cancel</span>Cancel Return
          </button>
        )}
        {canEditExchange  && (
          <button className="invoice__act-btn invoice__act-btn--return" onClick={onEditExchange}>
            <span className="material-icons" style={{ fontSize:15, marginRight:4 }}>edit</span>Edit Exchange
          </button>
        )}
        {canEditShipment  && (
          <button className="invoice__act-btn invoice__act-btn--return" onClick={onEditShipment}>
            <span className="material-icons" style={{ fontSize:15, marginRight:4 }}>edit</span>Edit Shipment
          </button>
        )}
        <button className="invoice__act-btn invoice__act-btn--download" onClick={handleDownload}>
          <span className="material-icons" style={{ fontSize:18 }}>download</span>
        </button>
        <button className="invoice__act-btn invoice__act-btn--print" onClick={handlePrint}>
          <span className="material-icons" style={{ fontSize:16, marginRight:4 }}>print</span>Print
        </button>
      </div>
    </div>
  );
}

// ─── Complete Modal ───────────────────────────────────────────────────────────

function CompleteModal({ txn, onClose, onSuccess }) {
  const [deliveredDate, setDeliveredDate] = useState('');
  const [notes,         setNotes]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const { showAlert, AlertRenderer }      = useAlert();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${txn?._raw?._id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'Completed' }),
      });
      if (res.ok) {
        onSuccess?.();
        showAlert('success', 'Order Completed!', 'The order has been marked as successfully delivered.', 'Done', onClose);
      } else {
        const err = await res.json();
        showAlert('error', 'Action Failed', err.message || 'Failed to mark order as completed.');
      }
    } catch { showAlert('error', 'Connection Error', 'Something went wrong. Please try again.'); }
    finally  { setLoading(false); }
  };

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--shipment">
          <h2 className="modal__title">Mark as Completed</h2>
          <p className="modal__desc">Confirm that the buyer has successfully received their order.</p>
          <div style={{ background:'rgba(0,0,0,0.04)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Customer:</span><span style={{ fontWeight:600 }}>{txn?.customer}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Order ID:</span><span style={{ fontWeight:600 }}>{txn?.id?.slice(-8)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Items:</span><span style={{ fontWeight:600 }}>{txn?._raw?.products?.map(i=>`${i.name} x${i.quantity}`).join(', ')||'—'}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Total Amount:</span><span style={{ fontWeight:600, color:'#8B333D' }}>₱ {(txn?._raw?.subTotal||0).toLocaleString()}.00</span></div>
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Date Delivered</label>
            <input className="shipment__input" type="date" value={deliveredDate} onChange={(e)=>setDeliveredDate(e.target.value)} />
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Notes (optional)</label>
            <textarea className="shipment__input" placeholder="Any additional notes about the delivery..." value={notes} onChange={(e)=>setNotes(e.target.value)} style={{ resize:'vertical', minHeight:64 }} />
          </div>
          <div className="modal__actions">
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>Cancel</button>
            <button className="modal__btn modal__btn--primary" onClick={handleConfirm} disabled={!deliveredDate||loading}>
              {loading ? 'Processing...' : 'Mark as Completed'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ txn, onClose }) {
  const methodMap = { cash: 'CASH', gcash: 'GCASH', card: 'Union Bank - CARD' };
  const [method, setMethod]          = useState(methodMap[txn?.method?.toLowerCase()] || txn?.method || '');
  const [ref,    setRef]             = useState('');
  const { showAlert, AlertRenderer } = useAlert();

  const handleConfirm = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${txn?._raw?._id}/payment`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ reference:ref }),
      });
      if (res.ok) {
        showAlert('success', 'Payment Confirmed!', 'Payment successfully recorded.', 'Done', onClose);
      } else {
        const err = await res.json();
        showAlert('error', 'Payment Failed', err.message || 'Failed to confirm payment. Please try again.');
      }
    } catch { showAlert('error', 'Connection Error', 'Something went wrong. Please try again.'); }
  };

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--payment">
          <h2 className="modal__title">Payment Confirmation</h2>
          <p className="modal__desc">If you already have your reference number, kindly input it below.</p>
          <div className="modal__field">
            <label className="modal__field-label">Payment Method:</label>
            <div className="modal__select-wrap">
              <select className="modal__select" value={method} onChange={(e)=>setMethod(e.target.value)}>
                <option value="">Select Payment Method</option>
                <option value="Union Bank - CARD">Union Bank - CARD</option>
                <option value="GCASH">GCASH</option>
                <option value="CASH">CASH</option>
              </select>
            </div>
          </div>
          <input className="modal__input" placeholder="Enter Payment Reference Number to confirm your transaction." value={ref} onChange={(e)=>setRef(e.target.value)} />
          <div className="modal__actions">
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>cancel</button>
            <button className="modal__btn modal__btn--primary" onClick={handleConfirm} disabled={!ref.trim()||!method}>Confirm Payment</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Shipment Modal ───────────────────────────────────────────────────────────

function ShipmentModal({ txn, onClose, onConfirm }) {
  const [method,  setMethod]  = useState('');
  const [courier, setCourier] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert, AlertRenderer } = useAlert();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // ── Step 1: update status to Shipped Out ──
      const statusRes = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${txn?._raw?._id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'Shipped Out' }),
      });
      if (!statusRes.ok) {
        const err = await statusRes.json();
        showAlert('error', 'Action Failed', err.message || 'Failed to confirm shipment.');
        return;
      }

      // ── Step 2: save shipment method + courier ──
      if (method || courier) {
        await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${txn?._raw?._id}/shipment`, {
          method:'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ shipmentMethod: method, courier }),
        });
      }

      onConfirm?.({ method, courier });
      showAlert('success', 'Shipment Confirmed!', 'Order has been marked as Shipped Out.', 'Done', onClose);
    } catch { showAlert('error', 'Connection Error', 'Something went wrong. Please try again.'); }
    finally  { setLoading(false); }
  };

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--shipment">
          <h2 className="modal__title">Confirm Shipment</h2>
          <p className="modal__desc">Please select the Shipment Method to proceed.</p>
          <div className="shipment__field">
            <label className="shipment__label">Shipment Method:</label>
            <div className="shipment__select-wrap">
              <select className="shipment__select" value={method} onChange={(e)=>setMethod(e.target.value)}>
                <option value="">Select Method</option>
                <option value="pickup">Pick-up</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Delivery Courier</label>
            <div className="shipment__select-wrap">
              <select className="shipment__select" value={courier} onChange={(e)=>setCourier(e.target.value)}>
                <option value="">Select Courier</option>
                <option value="shopee">Shopee Checkout</option>
                <option value="lalamove">Lalamove</option>
                <option value="jnt">J&T Express</option>
              </select>
            </div>
          </div>
          <div className="modal__actions">
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>Cancel</button>
            <button className="modal__btn modal__btn--primary" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Processing...' : 'Confirm Shipment'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Return Shipment Modal ────────────────────────────────────────────────────

function ReturnShipmentModal({ txn, onClose, onSuccess }) {
  const [courier,      setCourier]      = useState('');
  const [trackingNo,   setTrackingNo]   = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [condition,    setCondition]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const { showAlert, AlertRenderer }    = useAlert();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/returns/${txn?._raw?._id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'Return', trackingNo, courier, receivedDate, condition, notes }),
      });
      if (res.ok) {
        onSuccess?.();
        showAlert('success', 'Return Confirmed!', 'Item received and stock has been restored.', 'Done', onClose);
      } else {
        const err = await res.json();
        showAlert('error', 'Action Failed', err.message || 'Failed to confirm return.');
      }
    } catch { showAlert('error', 'Connection Error', 'Something went wrong. Please try again.'); }
    finally  { setLoading(false); }
  };

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--shipment">
          <h2 className="modal__title">Confirm Item Received</h2>
          <p className="modal__desc">Fill in the details to confirm the returned item has been received.</p>
          <div style={{ background:'rgba(0,0,0,0.04)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Customer:</span><span style={{ fontWeight:600 }}>{txn?.customer}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Return ID:</span><span style={{ fontWeight:600 }}>{txn?.id?.slice(-8)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Returning Items:</span><span style={{ fontWeight:600 }}>{txn?._raw?.returnItems?.map(i=>`${i.name} x${i.returnQuantity}`).join(', ')||'—'}</span></div>
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Delivery Courier</label>
            <div className="shipment__select-wrap">
              <select className="shipment__select" value={courier} onChange={(e)=>setCourier(e.target.value)}>
                <option value="">Select Courier</option>
                <option value="shopee">Shopee Checkout</option>
                <option value="lalamove">Lalamove</option>
                <option value="jnt">J&T Express</option>
              </select>
            </div>
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Tracking Number</label>
            <input className="shipment__input" placeholder="Enter return tracking number" value={trackingNo} onChange={(e)=>setTrackingNo(e.target.value)} />
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Date Received</label>
            <input className="shipment__input" type="date" value={receivedDate} onChange={(e)=>setReceivedDate(e.target.value)} />
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Item Condition</label>
            <div className="shipment__select-wrap">
              <select className="shipment__select" value={condition} onChange={(e)=>setCondition(e.target.value)}>
                <option value="">Select Condition</option>
                <option value="good">Good — resellable</option>
                <option value="damaged">Damaged — not resellable</option>
                <option value="defective">Defective — needs inspection</option>
              </select>
            </div>
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Notes (optional)</label>
            <textarea className="shipment__input" placeholder="Any additional notes..." value={notes} onChange={(e)=>setNotes(e.target.value)} style={{ resize:'vertical', minHeight:60 }} />
          </div>
          <div className="modal__actions">
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>Cancel</button>
            <button className="modal__btn modal__btn--primary" onClick={handleConfirm} disabled={!trackingNo.trim()||!receivedDate||!condition||loading}>
              {loading ? 'Processing...' : 'Confirm Received'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Cancel Return Modal ──────────────────────────────────────────────────────

function CancelReturnModal({ txn, onClose, onSuccess }) {
  const [loading, setLoading]        = useState(false);
  const { showAlert, AlertRenderer } = useAlert();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/returns/${txn?._raw?._id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'Cancelled' }),
      });
      if (res.ok) {
        onSuccess?.();
        showAlert('success', 'Return Cancelled', 'The return request has been cancelled. No stock changes were made.', 'Done', onClose);
      } else {
        const err = await res.json();
        showAlert('error', 'Failed', err.message || 'Could not cancel the return. Please try again.');
      }
    } catch { showAlert('error', 'Connection Error', 'Something went wrong. Please try again.'); }
    finally  { setLoading(false); }
  };

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--payment">
          <h2 className="modal__title">Cancel Return Request?</h2>
          <p className="modal__desc">
            This will cancel the return request. No stock changes will be made. This cannot be undone.
          </p>
          <div style={{ background:'rgba(153,2,20,0.05)', border:'1px solid rgba(153,2,20,0.15)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Customer:</span>
              <span style={{ fontWeight:600 }}>{txn?.customer}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Return ID:</span>
              <span style={{ fontWeight:600 }}>{txn?.id?.slice(-8)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Items:</span>
              <span style={{ fontWeight:600 }}>{txn?._raw?.returnItems?.map(i=>`${i.name} x${i.returnQuantity}`).join(', ')||'—'}</span>
            </div>
          </div>
          <div className="modal__actions">
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>No, keep it</button>
            <button className="modal__btn modal__btn--primary" style={{ background:'#990214' }} onClick={handleConfirm} disabled={loading}>
              {loading ? 'Cancelling...' : 'Yes, Cancel Return'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Edit Exchange Modal ──────────────────────────────────────────────────────

function EditExchangeModal({ txn, onClose, onSuccess }) {
  const [allProducts,   setAllProducts]   = useState([]);
  const [exchangeItems, setExchangeItems] = useState(
    txn?._raw?.returnItems?.map(i => ({
      ...i,
      returnSame:  false,
      newProduct:  i.replacementProduct?._id ?? (typeof i.replacementProduct === 'string' ? i.replacementProduct : ''),
      newQty:      i.replacementQuantity ?? i.returnQuantity,
    })) || []
  );
  const [loading, setLoading]        = useState(false);
  const { showAlert, AlertRenderer } = useAlert();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/products`)
      .then(r => r.json())
      .then(data => setAllProducts(data))
      .catch(err => console.error(err));
  }, []);

  const toggleReturnSame = (index) => {
    setExchangeItems(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, returnSame: !item.returnSame, newProduct: '', newQty: item.returnQuantity }
          : item
      )
    );
  };

  const handleConfirm = async () => {
    const needsProduct = exchangeItems.filter(i => !i.returnSame && !i.newProduct);
    if (needsProduct.length > 0) {
      showAlert('warning', 'Incomplete', 'Please select a replacement product for each item, or choose "Return Same Item".');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/returns/${txn?._raw?._id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:        'Exchanged',
          action:        'exchange',
          exchangeItems: exchangeItems.map(i => ({
            product:    i.returnSame ? null : i.newProduct,
            quantity:   i.newQty,
            returnSame: i.returnSame,
          })),
        }),
      });
      if (res.ok) {
        onSuccess?.();
        showAlert('success', 'Exchange Updated!', 'The replacement products have been updated successfully.', 'Done', onClose);
      } else {
        const err = await res.json();
        showAlert('error', 'Update Failed', err.message || 'Could not update the exchange. Please try again.');
      }
    } catch {
      showAlert('error', 'Connection Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--shipment">
          <h2 className="modal__title">Edit Exchange</h2>
          <p className="modal__desc">Update the replacement products for this exchange request.</p>
          <div style={{ background:'rgba(0,0,0,0.04)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Customer:</span>
              <span style={{ fontWeight:600 }}>{txn?.customer}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Return ID:</span>
              <span style={{ fontWeight:600 }}>{txn?.id?.slice(-8)}</span>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label className="shipment__label">Replacement Products:</label>
            {exchangeItems.map((item, i) => (
              <div
                key={i}
                style={{
                  background:   item.returnSame ? 'rgba(64,224,208,0.07)' : 'rgba(0,0,0,0.03)',
                  border:       item.returnSame ? '1px solid rgba(64,224,208,0.35)' : '1px solid transparent',
                  borderRadius: 8,
                  padding:      '10px 12px',
                  marginTop:    10,
                  transition:   'background 0.2s, border 0.2s',
                }}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <p style={{ fontSize:12, fontWeight:600, color:'#000', margin:0 }}>
                    Returning: <span style={{ color:'#8B333D' }}>{item.name}</span>{' '}
                    <span style={{ color:'rgba(0,0,0,0.45)' }}>x{item.returnQuantity}</span>
                  </p>
                  <button
                    onClick={() => toggleReturnSame(i)}
                    style={{
                      display:'flex', alignItems:'center', gap:5,
                      padding:'4px 10px', borderRadius:20,
                      border:      item.returnSame ? '1px solid rgba(64,224,208,0.7)' : '1px solid rgba(0,0,0,0.15)',
                      background:  item.returnSame ? 'rgba(64,224,208,0.18)' : 'rgba(0,0,0,0.04)',
                      color:       item.returnSame ? '#008B80' : 'rgba(0,0,0,0.5)',
                      fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.2s',
                    }}
                  >
                    <span className="material-icons" style={{ fontSize:13 }}>{item.returnSame ? 'check_circle' : 'undo'}</span>
                    {item.returnSame ? 'Returning Same Item' : 'Return Same Item'}
                  </button>
                </div>
                {item.replacementName && !item.returnSame && (
                  <p style={{ fontSize:11, color:'rgba(0,0,0,0.45)', marginBottom:6 }}>
                    Current replacement: {item.replacementName} x{item.replacementQuantity}
                  </p>
                )}
                {!item.returnSame && (
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                    <select
                      className="shipment__select" style={{ flex:1 }} value={item.newProduct}
                      onChange={(e) => { const u=[...exchangeItems]; u[i]={...u[i],newProduct:e.target.value}; setExchangeItems(u); }}
                    >
                      <option value="">Select replacement</option>
                      {allProducts.map(p => <option key={p._id} value={p._id}>{p.name} (Stock: {p.stock})</option>)}
                    </select>
                    <input
                      type="number" min={1} value={item.newQty}
                      onChange={(e) => { const u=[...exchangeItems]; u[i]={...u[i],newQty:Number(e.target.value)}; setExchangeItems(u); }}
                      style={{ width:60, padding:'6px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:12 }}
                    />
                    <span style={{ fontSize:11, color:'rgba(0,0,0,0.4)' }}>qty</span>
                  </div>
                )}
                {item.returnSame && (
                  <p style={{ fontSize:11, color:'#008B80', margin:'4px 0 0', fontStyle:'italic' }}>
                    The original item will be sent back. No new stock will be deducted.
                  </p>
                )}
              </div>
            ))}
          </div>
          <div style={{ background:'rgba(230,126,34,0.08)', border:'1px solid rgba(230,126,34,0.25)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'rgba(0,0,0,0.6)', marginBottom:12 }}>
            ⚠️ The old replacement stock will be restored. New replacement stock will be deducted only for items not marked as "Return Same Item".
          </div>
          <div className="modal__actions">
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>Cancel</button>
            <button className="modal__btn modal__btn--primary" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Updating...' : 'Update Exchange'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Edit Shipment Modal ──────────────────────────────────────────────────────

function EditShipmentModal({ txn, onClose, onSuccess }) {
  const [method,  setMethod]  = useState(txn?._raw?.shipmentMethod || '');
  const [courier, setCourier] = useState(txn?._raw?.courier        || '');
  const [loading, setLoading] = useState(false);
  const { showAlert, AlertRenderer } = useAlert();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${txn?._raw?._id}/shipment`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentMethod: method, courier }),
      });
      if (res.ok) {
        onSuccess?.();
        showAlert('success', 'Shipment Updated!', 'Shipment details have been updated successfully.', 'Done', onClose);
      } else {
        const err = await res.json();
        showAlert('error', 'Update Failed', err.message || 'Failed to update shipment details.');
      }
    } catch {
      showAlert('error', 'Connection Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--shipment">
          <h2 className="modal__title">Edit Shipment</h2>
          <p className="modal__desc">Update the shipment details before marking as completed.</p>
          <div style={{ background:'rgba(0,0,0,0.04)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Customer:</span>
              <span style={{ fontWeight:600 }}>{txn?.customer}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Order ID:</span>
              <span style={{ fontWeight:600 }}>{txn?.id?.slice(-8)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Items:</span>
              <span style={{ fontWeight:600 }}>{txn?._raw?.products?.map(i=>`${i.name} x${i.quantity}`).join(', ')||'—'}</span>
            </div>
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Shipment Method:</label>
            <div className="shipment__select-wrap">
              <select className="shipment__select" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="">Select Method</option>
                <option value="pickup">Pick-up</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
          </div>
          <div className="shipment__field">
            <label className="shipment__label">Delivery Courier</label>
            <div className="shipment__select-wrap">
              <select className="shipment__select" value={courier} onChange={(e) => setCourier(e.target.value)}>
                <option value="">Select Courier</option>
                <option value="shopee">Shopee Checkout</option>
                <option value="lalamove">Lalamove</option>
                <option value="jnt">J&T Express</option>
              </select>
            </div>
          </div>
          <div className="modal__actions">
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>Cancel</button>
            <button className="modal__btn modal__btn--primary" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Updating...' : 'Update Shipment'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Post Return Modal ────────────────────────────────────────────────────────

function PostReturnModal({ txn, onClose, onSuccess }) {
  const [action,        setAction]        = useState('');
  const [courier,       setCourier]       = useState('');
  const [trackingNo,    setTrackingNo]    = useState('');
  const [shippedDate,   setShippedDate]   = useState('');
  const [notes,         setNotes]         = useState('');
  const [allProducts,   setAllProducts]   = useState([]);
  const [exchangeItems, setExchangeItems] = useState(
    txn?._raw?.returnItems?.map(i => ({ ...i, newProduct:'', newQty: i.returnQuantity })) || []
  );
  const [loading, setLoading]        = useState(false);
  const { showAlert, AlertRenderer } = useAlert();

  const isExchangeMode = txn?._raw?.status?.toLowerCase() === 'exchanged';

  useEffect(() => { if (isExchangeMode) setAction('reship'); }, [isExchangeMode]);

  useEffect(() => {
    if (action === 'exchange') {
      fetch(`${import.meta.env.VITE_API_URL}/api/products`)
        .then(r => r.json())
        .then(data => setAllProducts(data))
        .catch(err => console.error(err));
    }
  }, [action]);

  const handleConfirm = async () => {
    if (!action) { showAlert('warning', 'Action Required', 'Please select an action before confirming.'); return; }
    if (action === 'reship') {
      if (!trackingNo.trim()) { showAlert('warning', 'Missing Tracking Number', 'Please enter a tracking number.'); return; }
      if (!shippedDate)       { showAlert('warning', 'Missing Shipped Date', 'Please enter the date the item was shipped.'); return; }
    }
    if (action === 'exchange' && exchangeItems.some(i => !i.newProduct)) {
      showAlert('warning', 'Incomplete Exchange', 'Please select a replacement product for each item.'); return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/returns/${txn?._raw?._id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          status:        action === 'exchange' ? 'Exchanged' : 'Reshipped',
          action, courier, trackingNo, shippedDate, notes,
          exchangeItems: action === 'exchange'
            ? exchangeItems.map(i => ({ product: i.newProduct, quantity: i.newQty }))
            : undefined,
        }),
      });
      if (res.ok) {
        onSuccess?.(action);
        showAlert(
          'success',
          action === 'reship' ? 'Reshipment Confirmed!' : 'Exchange Initiated!',
          action === 'reship'
            ? 'The same item has been reshipped to the customer.'
            : 'Status set to Exchanged. Confirm reshipped once the replacement is sent.',
          'Done', onClose
        );
      } else {
        const err = await res.json();
        showAlert('error', 'Action Failed', err.message || 'Failed to process return.');
      }
    } catch { showAlert('error', 'Connection Error', 'Something went wrong. Please try again.'); }
    finally  { setLoading(false); }
  };

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--shipment">
          <h2 className="modal__title">{isExchangeMode ? 'Confirm Reshipped' : 'Process Return'}</h2>
          <p className="modal__desc">
            {isExchangeMode
              ? 'Confirm that the replacement item has been sent to the customer.'
              : 'Select what action to take for the returned item.'}
          </p>
          <div style={{ background:'rgba(0,0,0,0.04)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Customer:</span><span style={{ fontWeight:600 }}>{txn?.customer}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:'rgba(0,0,0,0.5)' }}>Returned Items:</span><span style={{ fontWeight:600 }}>{txn?._raw?.returnItems?.map(i=>`${i.name} x${i.returnQuantity}`).join(', ')||'—'}</span></div>
            {txn?._raw?.returnItems?.some(i => i.replacementName || i.replacementProduct?.name) && (
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'rgba(0,0,0,0.5)' }}>Exchange For:</span>
                <span style={{ fontWeight:600, color:'#8B333D' }}>
                  {txn?._raw?.returnItems?.filter(i=>i.replacementName||i.replacementProduct?.name)
                    .map(i=>`${i.replacementName||i.replacementProduct?.name} x${i.replacementQuantity}`).join(', ')}
                </span>
              </div>
            )}
          </div>

          {!isExchangeMode && (
            <div className="shipment__field">
              <label className="shipment__label">Action:</label>
              <div style={{ display:'flex', gap:16, marginTop:6 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="action" value="reship" checked={action==='reship'} onChange={()=>setAction('reship')} />
                  Reship Same Item
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="action" value="exchange" checked={action==='exchange'} onChange={()=>setAction('exchange')} />
                  Exchange / Send Different Item
                </label>
              </div>
            </div>
          )}

          {action === 'exchange' && !isExchangeMode && (
            <div style={{ marginBottom:12 }}>
              <label className="shipment__label">Replacement Products:</label>
              {exchangeItems.map((item, i) => (
                <div key={i} style={{ background:'rgba(0,0,0,0.03)', borderRadius:6, padding:'8px 10px', marginTop:8 }}>
                  <p style={{ fontSize:12, fontWeight:600, marginBottom:6 }}>Returning: {item.name} x{item.returnQuantity}</p>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <select className="shipment__select" style={{ flex:1 }} value={item.newProduct}
                      onChange={(e) => { const u=[...exchangeItems]; u[i].newProduct=e.target.value; setExchangeItems(u); }}>
                      <option value="">Select replacement</option>
                      {allProducts.map(p=><option key={p._id} value={p._id}>{p.name} (Stock: {p.stock})</option>)}
                    </select>
                    <input type="number" min={1} value={item.newQty}
                      onChange={(e) => { const u=[...exchangeItems]; u[i].newQty=Number(e.target.value); setExchangeItems(u); }}
                      style={{ width:60, padding:'6px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:12 }} />
                    <span style={{ fontSize:11, color:'rgba(0,0,0,0.4)' }}>qty</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {action === 'exchange' && !isExchangeMode && (
            <div style={{ background:'rgba(139,51,61,0.06)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'rgba(0,0,0,0.5)', marginBottom:8 }}>
              After confirming, status will be set to <strong>Exchanged</strong>. You will enter courier and tracking details when you confirm the shipment.
            </div>
          )}

          {action === 'reship' && (
            <>
              <div className="shipment__field">
                <label className="shipment__label">Delivery Courier</label>
                <div className="shipment__select-wrap">
                  <select className="shipment__select" value={courier} onChange={(e)=>setCourier(e.target.value)}>
                    <option value="">Select Courier</option>
                    <option value="shopee">Shopee Checkout</option>
                    <option value="lalamove">Lalamove</option>
                    <option value="jnt">J&T Express</option>
                  </select>
                </div>
              </div>
              <div className="shipment__field">
                <label className="shipment__label">Tracking Number</label>
                <input className="shipment__input" placeholder="Enter tracking number" value={trackingNo} onChange={(e)=>setTrackingNo(e.target.value)} />
              </div>
              <div className="shipment__field">
                <label className="shipment__label">Date Shipped</label>
                <input className="shipment__input" type="date" value={shippedDate} onChange={(e)=>setShippedDate(e.target.value)} />
              </div>
              <div className="shipment__field">
                <label className="shipment__label">Notes (optional)</label>
                <textarea className="shipment__input" placeholder="Any additional notes..." value={notes} onChange={(e)=>setNotes(e.target.value)} style={{ resize:'vertical', minHeight:60 }} />
              </div>
            </>
          )}

          <div className="modal__actions">
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>Cancel</button>
            <button className="modal__btn modal__btn--primary" onClick={handleConfirm} disabled={!action||loading}>
              {loading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Return Modal ─────────────────────────────────────────────────────────────

function ReturnModal({ txn, onClose, onSuccess }) {
  const [step,         setStep]         = useState('form');
  const [product,      setProduct]      = useState('');
  const [qty,          setQty]          = useState('');
  const [reason,       setReason]       = useState('');
  const [returnItems,  setReturnItems]  = useState([]);
  const [loading,      setLoading]      = useState(false);
  const { showAlert, AlertRenderer }    = useAlert();

  const items   = txn?._raw?.products || [];
  const REASONS = { wrong:'Wrong Item', defective:'Defective', size:'Wrong Size' };

  const handleAdd = () => {
    if (!product || !qty || !reason) return;
    const found = items.find((_, i) => String(i) === product);
    setReturnItems(prev => [...prev, {
      id:             `RP-${String(prev.length+1).padStart(3,'0')}`,
      product:        found?.product,
      name:           found?.name || product,
      price:          found?.price || 0,
      returnQuantity: Number(qty),
      reason:         REASONS[reason],
    }]);
    setProduct(''); setQty(''); setReason('');
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/returns`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          orderId:     txn?._raw?._id,
          customer:    txn?.customer,
          returnType:  'return',
          returnItems: returnItems.map(item => ({
            product:        item.product,
            name:           item.name,
            price:          item.price,
            returnQuantity: item.returnQuantity,
            reason:         item.reason,
          })),
        }),
      });
      if (res.ok) {
        onSuccess?.();
        showAlert('success', 'Return Submitted!', 'The return request has been successfully recorded.', 'Done', onClose);
      } else {
        const err = await res.json();
        showAlert('error', 'Submission Failed', err.message || 'Failed to submit return request.');
      }
    } catch { showAlert('error', 'Connection Error', 'Something went wrong. Please try again.'); }
    finally  { setLoading(false); }
  };

  if (step === 'confirm') return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--return modal--return-lg">
          <button className="modal__close" onClick={onClose}><span className="material-icons">close</span></button>
          <h2 className="return__title">Request Return</h2>
          <p className="return__verify-note">Please verify the product details before confirming the return.</p>
          <div className="return__info-grid">
            <div className="return__info-row"><span className="return__info-label">Transaction No:</span><span className="return__info-value">{txn?.id?.slice(-8)}</span></div>
            <div className="return__info-row return__info-row--right"><span className="return__info-label">Customer Name:</span><span className="return__info-value">{txn?.customer}</span></div>
            <div className="return__info-row"><span className="return__info-label">Date of Order:</span><span className="return__info-value">{txn?.date}</span></div>
          </div>
          <h3 className="return__section-title">Return Details:</h3>
          <div className="return__table-wrap">
            <table className="return__table">
              <thead><tr className="return__thead-row"><th>ID</th><th>Return Item</th><th>Qty</th><th>Reason</th></tr></thead>
              <tbody>
                {returnItems.length === 0
                  ? <tr><td colSpan={4} className="return__empty">No items added yet</td></tr>
                  : returnItems.map(item => (
                      <tr key={item.id} className="return__row">
                        <td>{item.id}</td><td>{item.name}</td><td>{item.returnQuantity}</td><td>{item.reason}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div className="modal__actions" style={{ marginTop:16 }}>
            <button className="modal__btn modal__btn--cancel" onClick={()=>setStep('form')}>Discard</button>
            <button className="modal__btn modal__btn--outline" onClick={()=>setStep('form')}>Edit</button>
            <button className="modal__btn modal__btn--primary" onClick={handleConfirm} disabled={returnItems.length===0||loading}>
              {loading ? 'Submitting...' : 'Confirm Return'}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {AlertRenderer}
      <div className="modal-overlay">
        <div className="modal modal--return modal--return-lg">
          <button className="modal__close" onClick={onClose}><span className="material-icons">close</span></button>
          <h2 className="return__title">Request Return</h2>
          <div className="return__info-grid">
            <div className="return__info-row"><span className="return__info-label">Transaction No:</span><span className="return__info-value">{txn?.id?.slice(-8)}</span></div>
            <div className="return__info-row return__info-row--right"><span className="return__info-label">Customer Name:</span><span className="return__info-value">{txn?.customer}</span></div>
            <div className="return__info-row"><span className="return__info-label">Date of Order:</span><span className="return__info-value">{txn?.date}</span></div>
          </div>
          <h3 className="return__section-title">Return Product</h3>
          <div className="return__product-row">
            <div className="return__product-col">
              <label className="return__form-label">Product:</label>
              <div className="return__select-wrap">
                <select className="return__select return__select--product" value={product} onChange={(e)=>setProduct(e.target.value)}>
                  <option value="">Select Return Product</option>
                  {items.map((item, i) => <option key={i} value={String(i)}>{item.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="return__qty-reason-row">
            <div className="return__form-group">
              <label className="return__form-label">Quantity:</label>
              <input
                className="return__select"
                type="number" min={1}
                max={items.find((_,i)=>String(i)===product)?.quantity||1}
                placeholder={`Max: ${items.find((_,i)=>String(i)===product)?.quantity||'—'}`}
                value={qty}
                onChange={(e) => {
                  const max = items.find((_,i)=>String(i)===product)?.quantity||1;
                  setQty(String(Math.max(1, Math.min(Number(e.target.value), max))));
                }}
                style={{ width:'100%' }}
              />
            </div>
            <div className="return__form-group">
              <label className="return__form-label">Reason:</label>
              <div className="return__select-wrap">
                <select className="return__select" value={reason} onChange={(e)=>setReason(e.target.value)}>
                  <option value="">Select Reason</option>
                  <option value="wrong">Wrong Item</option>
                  <option value="defective">Defective</option>
                  <option value="size">Wrong Size</option>
                </select>
              </div>
            </div>
          </div>
          <div className="return__add-row">
            <button className="return__add-btn" onClick={handleAdd} disabled={!product||!qty||!reason}>
              Add Return Product
            </button>
          </div>
          <h3 className="return__section-title">Return Details:</h3>
          <div className="return__table-wrap">
            <table className="return__table">
              <thead><tr className="return__thead-row"><th>ID</th><th>Return Item</th><th>Qty</th><th>Reason</th></tr></thead>
              <tbody>
                {returnItems.length === 0
                  ? <tr><td colSpan={4} className="return__empty">No items added yet</td></tr>
                  : returnItems.map(item => (
                      <tr key={item.id} className="return__row">
                        <td>{item.id}</td><td>{item.name}</td><td>{item.returnQuantity}</td><td>{item.reason}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div className="modal__actions" style={{ marginTop:16 }}>
            <button className="modal__btn modal__btn--cancel" onClick={onClose}>Discard</button>
            <button className="modal__btn modal__btn--primary" onClick={()=>setStep('confirm')} disabled={returnItems.length===0}>
              Submit Return
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Transaction Page ─────────────────────────────────────────────────────────

export default function TransactionPage() {
  const TABS    = ['Pending', 'Completed', 'Cancelled', 'Return'];
  const navigate = useNavigate();

  const [orders,              setOrders]              = useState([]);
  const [returns,             setReturns]             = useState([]);
  const [loadingOrders,       setLoadingOrders]       = useState(true);
  const [activeTab,           setActiveTab]           = useState('Pending');
  const [search,              setSearch]              = useState('');
  const [statusFilter,        setStatusFilter]        = useState('all');
  const [statusDropOpen,      setStatusDropOpen]      = useState(false);
  const [dateFrom,            setDateFrom]            = useState('');
  const [dateTo,              setDateTo]              = useState('');
  const [cancelModal,         setCancelModal]         = useState(null);
  const [cancelReturnModal,   setCancelReturnModal]   = useState(null);
  const [editExchangeModal,   setEditExchangeModal]   = useState(null);
  const [overdueDays,         setOverdueDays]         = useState(7);
  const [customerInfoTxn,     setCustomerInfoTxn]     = useState(null);
  const [invoiceTxn,          setInvoiceTxn]          = useState(null);
  const [paymentModal,        setPaymentModal]        = useState(null);
  const [shipmentModal,       setShipmentModal]       = useState(null);
  const [returnModal,         setReturnModal]         = useState(null);
  const [returnShipmentModal, setReturnShipmentModal] = useState(null);
  const [postReturnModal,     setPostReturnModal]     = useState(null);
  const [completeModal,       setCompleteModal]       = useState(null);
  const [editShipmentModal,   setEditShipmentModal]   = useState(null);

  const { showAlert, AlertRenderer } = useAlert();
  const statusThRef = useRef(null);

  const checkAndMarkOverdue = async (ordersList, days) => {
    const now = new Date();
    const overdueOrders = ordersList.filter(order => {
      if (order.status?.toLowerCase() !== 'reserved') return false;
      return (now - new Date(order.createdAt)) / (1000*60*60*24) >= days;
    });
    if (overdueOrders.length === 0) return false;
    await Promise.all(overdueOrders.map(order =>
      fetch(`${import.meta.env.VITE_API_URL}/api/orders/${order._id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'Overdue' }),
      })
    ));
    return true;
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ordersRes, overdueRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/orders`),
          fetch(`${import.meta.env.VITE_API_URL}/api/overduesetting`),
        ]);
        const [ordersData, overdueData] = await Promise.all([ordersRes.json(), overdueRes.json()]);
        const days = overdueData?.overdueDays || 7;
        setOverdueDays(days);
        const hadOverdue = await checkAndMarkOverdue(ordersData, days);
        if (hadOverdue) {
          const r = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`);
          setOrders(await r.json());
        } else {
          setOrders(ordersData);
        }
      } catch (err) {
        console.error('Failed to fetch:', err);
        showAlert('error', 'Failed to Load', 'Could not load transactions. Please check your connection.');
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/returns`)
      .then(r=>r.json()).then(data=>setReturns(data))
      .catch(err=>console.error('Failed to fetch returns:', err));
  }, []);

  useEffect(() => {
    const h = (e) => { if (statusThRef.current && !statusThRef.current.contains(e.target)) setStatusDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const refreshOrders = async () => {
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`);
      const data = await res.json();
      const hadOverdue = await checkAndMarkOverdue(data, overdueDays);
      if (hadOverdue) {
        const r = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`);
        setOrders(await r.json());
      } else {
        setOrders(data);
      }
    } catch (err) { console.error('Failed to refresh orders:', err); }
  };

  const refreshReturns = () => {
    fetch(`${import.meta.env.VITE_API_URL}/api/returns`)
      .then(r=>r.json()).then(data=>setReturns(data))
      .catch(err=>console.error('Failed to refresh returns:', err));
  };

  const isCompleted = activeTab === 'Completed';
  const isPending   = activeTab === 'Pending';
  const isReturn    = activeTab === 'Return';
  const isCancelled = activeTab === 'Cancelled';

  const rawData = useMemo(() => {
    return orders.filter((order) => {
      const status = order.status?.toLowerCase();
      if (activeTab==='Pending')   return ['reserved','overdue'].includes(status);
      if (activeTab==='Completed') return ['to ship','shipped out','completed'].includes(status);
      if (activeTab==='Cancelled') return status==='cancelled';
      return false;
    });
  }, [orders, activeTab]);

  const tableData = useMemo(() => {
    if (isReturn) {
      return [...returns]
        .filter(r => r._id?.toLowerCase().includes(search.toLowerCase()) || r.customer?.toLowerCase().includes(search.toLowerCase()))
        .filter(r => statusFilter==='all' || r.status?.toLowerCase()===statusFilter)
        .filter(r => {
          if (!dateFrom && !dateTo) return true;
          const d = new Date(r.createdAt);
          if (dateFrom && d < new Date(dateFrom)) return false;
          if (dateTo   && d > new Date(dateTo+'T23:59:59')) return false;
          return true;
        })
        .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))
        .map(r => ({
          id:        r._id,
          customer:  r.customer,
          date:      new Date(r.createdAt).toLocaleString('en-PH',{month:'2-digit',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),
          total:     0, method:'—', ref:'—', refDate:'—',
          status:    r.status?.toLowerCase(),
          returnQty: r.returnItems?.reduce((sum,i)=>sum+i.returnQuantity,0)||0,
          reason:    r.returnItems?.map(i=>i.reason).join(', ')||'—',
          _raw:      r,
        }));
    }

    let d = rawData
      .map(order => ({
        id:        order._id,
        customer:  order.nameTobill,
        date:      new Date(order.createdAt).toLocaleString('en-PH',{month:'2-digit',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),
        total:     order.subTotal,
        method:    order.paymentMethod,
        ref:       order.paymentReference||'—',
        refDate:   order.updatedAt ? new Date(order.updatedAt).toLocaleString('en-PH',{month:'2-digit',day:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—',
        status:    order.status?.toLowerCase(),
        returnQty: '', reason: '',
        _raw:      order,
      }))
      .filter(r => {
        if (!dateFrom && !dateTo) return true;
        const created = new Date(r._raw.createdAt);
        const updated = new Date(r._raw.updatedAt);
        const from = dateFrom ? new Date(dateFrom) : null;
        const to   = dateTo   ? new Date(dateTo+'T23:59:59') : null;
        return ((!from||created>=from)&&(!to||created<=to)) || ((!from||updated>=from)&&(!to||updated<=to));
      })
      .filter(r => r.id?.toLowerCase().includes(search.toLowerCase()) || r.customer?.toLowerCase().includes(search.toLowerCase()));

    if (statusFilter !== 'all') d = d.filter(r => r.status === statusFilter);
    return [...d].sort((a,b) => new Date(b._raw.createdAt)-new Date(a._raw.createdAt));
  }, [rawData, returns, search, statusFilter, isReturn, dateFrom, dateTo]);

  const formatCurrency = (n) => '₱ ' + Number(n).toLocaleString('en-PH',{minimumFractionDigits:2});

  const showCustomerInfo = (isPending||isCancelled) && customerInfoTxn !== null;
  const showInvoice      = (isCompleted||isReturn)  && invoiceTxn      !== null;
  const showSidePanel    = showCustomerInfo || showInvoice;

  const handleTabChange = (tab) => {
    setActiveTab(tab); setStatusFilter('all'); setStatusDropOpen(false);
    setInvoiceTxn(null); setCustomerInfoTxn(null);
  };

  const handleRowClick = (txn) => {
    if (isPending||isCancelled) setCustomerInfoTxn(prev => prev?.id===txn.id ? null : txn);
    else if (isCompleted||isReturn) setInvoiceTxn(prev => prev?.id===txn.id ? null : txn);
  };

  const colSpan = isCompleted ? 7 : isPending ? 6 : isReturn ? 7 : 5;

  return (
    <div className="txnpage">
      {AlertRenderer}

      <div className="txnpage__header">
        <div className="txnpage__title-block">
          <h1 className="txnpage__title">TRANSACTION</h1>
          <p className="txnpage__subtitle">Track and manage all customer orders and transaction details.</p>
        </div>
        <Topbar />
      </div>

      <div className="txnpage__controls">
        <div className="txnpage__tabs">
          {TABS.map(tab => (
            <button key={tab} className={`txnpage__tab ${activeTab===tab?'txnpage__tab--active':''}`} onClick={()=>handleTabChange(tab)}>{tab}</button>
          ))}
        </div>
        <div className="txnpage__toolbar">
          <div className="txnpage__search">
            <span className="material-icons txnpage__search-icon">search</span>
            <input className="txnpage__search-input" placeholder="Search" value={search} onChange={(e)=>setSearch(e.target.value)} />
          </div>
          <div className="txnpage__date-filter">
            <span className="material-icons txnpage__date-icon">filter_list</span>
            <span className="txnpage__date-label">Date:</span>
            <input type="date" className="txnpage__date-input" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} />
            <span className="txnpage__date-sep">-</span>
            <input type="date" className="txnpage__date-input" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className={`txnpage__body ${showSidePanel?'txnpage__body--split':''}`}>
        <div className="txnpage__card">
          <div className="txnpage__table-wrap">
            <table className="txnpage__table">
              <thead>
                <tr className="txnpage__thead-row">
                  <th>Transaction ID</th>
                  <th>Customer Full Name</th>
                  <th>{isReturn ? 'Date of Return' : 'Date of Order'}</th>
                  {(isPending||isCompleted) && <th>Payment Method</th>}
                  {isCompleted && <th>Payment Reference</th>}
                  <th>Total Amount</th>
                  {isReturn && <th>Return Qty</th>}
                  {isReturn && <th>Reason</th>}
                  <th
                    ref={statusThRef}
                    className="txnpage__th-status"
                    onClick={()=>{ if(!isCancelled) setStatusDropOpen(v=>!v); }}
                    style={{ cursor:!isCancelled?'pointer':'default' }}
                  >
                    <span className="txnpage__th-status-inner">
                      Status
                      {!isCancelled && <span className={`material-icons txnpage__th-arrow ${statusDropOpen?'txnpage__th-arrow--open':''}`}>arrow_drop_down</span>}
                    </span>
                    {statusDropOpen && !isCancelled && (
                      <div className="txnpage__status-drop" onClick={(e)=>e.stopPropagation()}>
                        <div className={`txnpage__status-drop-row ${statusFilter==='all'?'txnpage__status-drop-row--active':''}`} onClick={()=>{setStatusFilter('all');setStatusDropOpen(false);}}>
                          <span className="txnpage__status-drop-all">All</span>
                        </div>
                        {TAB_STATUSES[activeTab].map(s => (
                          <div key={s} className={`txnpage__status-drop-row ${statusFilter===s?'txnpage__status-drop-row--active':''}`} onClick={()=>{setStatusFilter(s);setStatusDropOpen(false);}}>
                            <StatusBadge status={s} />
                          </div>
                        ))}
                      </div>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingOrders ? (
                  <tr><td colSpan={colSpan} style={{ textAlign:'center', padding:'32px 16px', color:'rgba(0,0,0,0.35)', fontSize:13 }}>Loading orders...</td></tr>
                ) : tableData.length === 0 ? (
                  <tr><td colSpan={colSpan} style={{ textAlign:'center', padding:'32px 16px', color:'rgba(0,0,0,0.35)', fontSize:13 }}>No transactions found.</td></tr>
                ) : tableData.map((row, i) => (
                  <tr key={row.id+i}
                    className={`txnpage__row ${(invoiceTxn?.id===row.id||customerInfoTxn?.id===row.id)?'txnpage__row--active':''}`}
                    onClick={()=>handleRowClick(row)}
                    style={{ cursor:'pointer' }}
                  >
                    <td className="txnpage__td--id">{row.id?.slice(-8)}</td>
                    <td>{row.customer}</td>
                    <td>{row.date}</td>
                    {(isPending||isCompleted) && <td>{row.method}</td>}
                    {isCompleted && <td><div className="txnpage__ref-num">{row.ref}</div><div className="txnpage__ref-date">{row.refDate}</div></td>}
                    <td>{isReturn?'—':formatCurrency(row.total)}</td>
                    {isReturn && <td>{row.returnQty}</td>}
                    {isReturn && <td>{row.reason}</td>}
                    <td><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showCustomerInfo && (
          <div className="txnpage__invoice-wrap">
            <CustomerInfoPanel
              txn={customerInfoTxn}
              onConfirmPayment={()=>setPaymentModal(customerInfoTxn)}
              onClose={()=>setCustomerInfoTxn(null)}
              onEdit={()=>navigate('/pos')}
              onCancel={()=>setCancelModal(customerInfoTxn)}
              readOnly={isCancelled}
            />
          </div>
        )}

        {showInvoice && (
          <div className="txnpage__invoice-wrap">
            <InvoicePanel
              txn={invoiceTxn}
              onReturn={()=>setReturnModal(invoiceTxn)}
              onConfirmShipment={()=>setShipmentModal(invoiceTxn)}
              onConfirmComplete={()=>setCompleteModal(invoiceTxn)}
              onClose={()=>setInvoiceTxn(null)}
              isReturnMode={isReturn}
              onReturnProduct={()=>setReturnShipmentModal(invoiceTxn)}
              onPostReturn={()=>setPostReturnModal(invoiceTxn)}
              onCancel={()=>setCancelModal(invoiceTxn)}
              onCancelReturn={()=>setCancelReturnModal(invoiceTxn)}
              onEditExchange={()=>setEditExchangeModal(invoiceTxn)}
              onEditShipment={()=>setEditShipmentModal(invoiceTxn)}
            />
          </div>
        )}

        {cancelModal && (
          <div className="modal-overlay">
            <div className="modal modal--payment">
              <h2 className="modal__title">Cancel Order</h2>
              <p className="modal__desc">Are you sure you want to cancel this order?</p>
              <div className="modal__actions">
                <button className="modal__btn modal__btn--cancel" onClick={()=>setCancelModal(null)}>No, go back</button>
                <button className="modal__btn modal__btn--primary"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${cancelModal._raw._id}/status`, {
                        method:'PATCH', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ status:'Cancelled' }),
                      });
                      if (res.ok) {
                        refreshOrders(); setCancelModal(null); setCustomerInfoTxn(null);
                        showAlert('success', 'Order Cancelled', 'The order has been successfully cancelled.');
                      } else {
                        const err = await res.json();
                        showAlert('error', 'Cancellation Failed', err.message||'Failed to cancel the order.');
                      }
                    } catch { showAlert('error', 'Connection Error', 'Failed to cancel order. Please try again.'); }
                  }}
                >
                  Yes, Cancel Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {paymentModal && (
        <PaymentModal txn={paymentModal} onClose={()=>{ refreshOrders(); setPaymentModal(null); setCustomerInfoTxn(null); }} />
      )}
      {shipmentModal && (
        <ShipmentModal txn={shipmentModal} onClose={()=>{ refreshOrders(); setShipmentModal(null); setInvoiceTxn(null); }} onConfirm={()=>refreshOrders()} />
      )}
      {returnModal && (
        <ReturnModal txn={returnModal} onClose={()=>setReturnModal(null)} onSuccess={()=>{ refreshReturns(); setReturnModal(null); setInvoiceTxn(null); }} />
      )}
      {returnShipmentModal && (
        <ReturnShipmentModal txn={returnShipmentModal} onClose={()=>setReturnShipmentModal(null)} onSuccess={()=>{ refreshReturns(); setReturnShipmentModal(null); setInvoiceTxn(null); }} />
      )}
      {completeModal && (
        <CompleteModal txn={completeModal} onClose={()=>setCompleteModal(null)} onSuccess={()=>{ refreshOrders(); setCompleteModal(null); setInvoiceTxn(null); }} />
      )}
      {postReturnModal && (
        <PostReturnModal txn={postReturnModal} onClose={()=>setPostReturnModal(null)} onSuccess={()=>{ refreshReturns(); setPostReturnModal(null); setInvoiceTxn(null); }} />
      )}
      {cancelReturnModal && (
        <CancelReturnModal
          txn={cancelReturnModal}
          onClose={()=>setCancelReturnModal(null)}
          onSuccess={()=>{ refreshReturns(); setCancelReturnModal(null); setInvoiceTxn(null); }}
        />
      )}
      {editExchangeModal && (
        <EditExchangeModal
          txn={editExchangeModal}
          onClose={()=>setEditExchangeModal(null)}
          onSuccess={()=>{ refreshReturns(); setEditExchangeModal(null); setInvoiceTxn(null); }}
        />
      )}
      {editShipmentModal && (
        <EditShipmentModal
          txn={editShipmentModal}
          onClose={()=>setEditShipmentModal(null)}
          onSuccess={()=>{ refreshOrders(); setEditShipmentModal(null); setInvoiceTxn(null); }}
        />
      )}
    </div>
  );
}