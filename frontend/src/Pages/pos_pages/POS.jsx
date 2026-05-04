import React, { useState, useEffect } from 'react';
import Topbar from '../../Components/notif/Topbar';
import './POS.css';

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const formatPeso = (n) => 'P ' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

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
      <div style={{ background:'#fff', borderRadius:12, padding:'36px 32px 28px', width:'100%', maxWidth:420, textAlign:'center', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', position:'relative' }}>
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

// ─── Main POS Component ───────────────────────────────────────────────────────

export default function POS() {
  const [products,       setProducts]       = useState([]);
  const [categories,     setCategories]     = useState(['All']);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [sels,           setSels]           = useState({});
  const [cart,           setCart]           = useState([]);
  const [customerName,   setCustomerName]   = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState('Cash');
  const [editMode,       setEditMode]       = useState(false);
  const [modal,          setModal]          = useState(null);
  const [paymentRef,     setPaymentRef]     = useState('');
  const [loading,        setLoading]        = useState(true);
  const [alertModal,     setAlertModal]     = useState(null);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({
      type, title, message, btnLabel,
      onClose: onClose ?? (() => setAlertModal(null)),
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/api/products`),
          fetch(`${import.meta.env.VITE_API_URL}/api/productcategory`),
        ]);
        const [prodData, catData] = await Promise.all([
          prodRes.json(),
          catRes.json(),
        ]);

        setProducts(prodData);
        setCategories(['All', ...catData.map(c => c.name)]);

        const initSels = {};
        prodData.forEach(p => {
          // ✅ FIX: p.set and p.size are arrays of populated objects
          initSels[p._id] = {
            set:  p.set?.[0]?.name  || '',
            size: p.size?.[0]?.name || '',
            qty:  p.slot || 1,
          };
        });
        setSels(initSels);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        showAlert('error', 'Failed to Load', 'Could not load products. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchCat    = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = !searchQuery ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.productCode?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total    = subtotal;

  const updateSel = (pid, field, val) =>
    setSels((prev) => ({ ...prev, [pid]: { ...prev[pid], [field]: val } }));

  const addToCart = (product) => {
    const sel = sels[product._id];
    const key = `${product._id}_${sel?.set}_${sel?.size}`;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + (sel?.qty || 1) };
        return next;
      }
      return [...prev, {
        id:        Date.now() + Math.random(),
        key,
        productId: product._id,
        name:      product.name,
        img:       product.images?.[0] || '',
        price:     product.wholesalePrice,
        set:       sel?.set  || '',
        size:      sel?.size || '',
        sizes:     product.size?.map(s => s.name) || [],
        qty:       sel?.qty  || 1,
      }];
    });
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const updateCartQty  = (id, delta) =>
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));

  const handlePlaceOrder = () => {
    if (!customerName.trim()) {
      showAlert('warning', 'Customer Name Required', "Please enter the customer's name in the Bill To field before placing an order.", 'Got it');
      return;
    }
    if (cart.length === 0) {
      showAlert('warning', 'Cart is Empty', 'Please add at least one product to the cart before placing an order.', 'Got it');
      return;
    }
    setModal('confirm');
  };

  const handleNewOrder = () => {
    setCart([]); setCustomerName(''); setPaymentMethod('Cash');
    setPaymentRef(''); setEditMode(false); setModal(null); setAlertModal(null);
  };

  const getPaymentMethodKey = () => {
    if (paymentMethod === 'Cash')       return 'cash';
    if (paymentMethod === 'GCash')      return 'gcash';
    if (paymentMethod === 'Union Bank') return 'card';
    return 'cash';
  };

  const handleConfirmOrder = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameTobill:    customerName,
          products:      cart.map(item => ({ product: item.productId, quantity: item.qty })),
          paymentMethod: getPaymentMethodKey(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setModal(null);
        showAlert('error', 'Order Failed', err.message || 'Failed to place the order. Please try again.', 'Try Again');
        return;
      }

      const order = await res.json();

      if (paymentMethod === 'Cash') {
        setModal(null);
        showAlert(
          'success',
          'Order Successful!',
          'Cash order processed. Stock updated and ready to ship.',
          'New Order',
          () => { setAlertModal(null); handleNewOrder(); }
        );
        return;
      }

      setModal({ type: 'payref', orderId: order._id });

    } catch (err) {
      console.error('Order error:', err);
      setModal(null);
      showAlert('error', 'Connection Error', 'Something went wrong. Please check your connection and try again.', 'Try Again');
    }
  };

  const handleSubmitReference = async () => {
    if (!paymentRef.trim()) {
      showAlert('warning', 'Reference Required', 'Please enter the payment reference number.', 'Got it');
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${modal.orderId}/payment`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: paymentRef }),
      });

      if (!res.ok) {
        const err = await res.json();
        showAlert('error', 'Payment Failed', err.message || 'Failed to confirm payment. Please try again.', 'Try Again');
        return;
      }

      setModal(null);
      showAlert(
        'success',
        'Payment Confirmed!',
        'Reference saved. Order is now marked as To Ship.',
        'New Order',
        () => { setAlertModal(null); handleNewOrder(); }
      );
    } catch (err) {
      console.error('Payment ref error:', err);
      showAlert('error', 'Connection Error', 'Something went wrong. Please try again.', 'Try Again');
    }
  };

  const handlePayLater = () => {
    setModal(null);
    showAlert(
      'success',
      'Order Saved!',
      'Order is reserved. Payment reference can be submitted later in the Transactions page.',
      'New Order',
      () => { setAlertModal(null); handleNewOrder(); }
    );
  };

  if (loading) return <div className="pos__loading">Loading products...</div>;

  return (
    <div className="pos">
      {alertModal && (
        <AlertModal
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          btnLabel={alertModal.btnLabel}
          onClose={alertModal.onClose}
        />
      )}

      <div className="pos__page">
        <div className="pos__header">
          <div className="pos__title-block">
            <h1 className="pos__title">ORDER</h1>
            <p className="pos__subtitle">Select products and create orders quickly for a smooth checkout.</p>
          </div>
          <Topbar />
        </div>

        <div className="pos__cat-row">
          <div className="pos__cat-bar">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`pos__cat-btn${activeCategory === cat ? ' pos__cat-btn--active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >{cat}</button>
            ))}
          </div>
          <div className="pos__search-wrap">
            <span className="material-icons pos__search-icon">search</span>
            <input
              className="pos__search-input"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="pos__body">
          <div className="pos__products-area">
            <p className="pos__showing">Showing {filteredProducts.length} items</p>
            {filteredProducts.length === 0 ? (
              <div className="pos__no-products">No products found.</div>
            ) : (
              <div className="pos__grid">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    sel={sels[product._id]}
                    onSel={(f, v) => updateSel(product._id, f, v)}
                    onAdd={() => addToCart(product)}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="pos__panel">
            <div className="pos__panel-scroll">
              <p className="pos__panel-section-title">Customer Information</p>
              <div className="pos__bill-row">
                <span className="pos__bill-label">Bill To:</span>
                <input
                  className="pos__bill-input"
                  placeholder="Enter Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="pos__panel-hdr">
                <p className="pos__panel-section-title">Order Details</p>
                {cart.length > 0 && (
                  <button className="pos__edit-tag" onClick={() => setEditMode((e) => !e)}>
                    {editMode ? 'Done' : 'Edit'}
                  </button>
                )}
              </div>

              {cart.length === 0 && (
                <div className="pos__cart-empty">
                  <span className="material-icons">shopping_cart</span>
                  No items added yet
                </div>
              )}

              <div className="pos__cart">
                {cart.map((item) => (
                  <div key={item.id} className={`pos__cart-item${editMode ? ' pos__cart-item--edit' : ''}`}>
                    <div className="pos__cart-img-wrap">
                      <img src={item.img} alt={item.name} className="pos__cart-img" onError={(e) => (e.target.style.display = 'none')} />
                    </div>
                    <div className="pos__cart-info">
                      <p className="pos__cart-name">{item.name}</p>
                      <p className="pos__cart-variant">
                        {item.set}
                        {item.sizes && item.sizes.length > 0 && (
                          <span className="pos__cart-sizes"> · Size: {item.size}</span>
                        )}
                      </p>
                      <p className="pos__cart-price">P {item.price.toLocaleString()}.00</p>
                    </div>
                    <div className="pos__cart-right">
                      <div className="pos__mini-stepper">
                        <button onClick={() => updateCartQty(item.id, -1)}>−</button>
                        <span>{item.qty}</span>
                        <button onClick={() => updateCartQty(item.id, 1)}>+</button>
                      </div>
                      <span className="pos__cart-qty-lbl">{item.qty}x</span>
                    </div>
                    {editMode && (
                      <button className="pos__del-btn" onClick={() => removeFromCart(item.id)}>
                        <span className="material-icons">delete_outline</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <p className="pos__panel-section-title pos__panel-section-title--mt">Order Summary</p>
              <div className="pos__summary">
                <div className="pos__sum-row"><span>Sub Total</span><span>{formatPeso(subtotal)}</span></div>
                <div className="pos__sum-row"><span>Tax</span><span>{formatPeso(0)}</span></div>
                <div className="pos__sum-row"><span>Discount</span><span>{formatPeso(0)}</span></div>
                <div className="pos__sum-divider" />
                <div className="pos__sum-total">
                  <span className="pos__sum-total-label">TOTAL AMOUNT</span>
                  <span className="pos__sum-total-val">{formatPeso(total)}</span>
                </div>
              </div>

              <p className="pos__panel-section-title">Payment Method</p>
              <div className="pos__pay-btns">
                {[{ id:'Cash', icon:'attach_money' }, { id:'GCash', icon:'qr_code_scanner' }, { id:'Union Bank', icon:'add_card' }].map((pm) => (
                  <button
                    key={pm.id}
                    className={`pos__pay-btn${paymentMethod === pm.id ? ' pos__pay-btn--active' : ''}`}
                    onClick={() => setPaymentMethod(pm.id)}
                  >
                    <span className="material-icons">{pm.icon}</span>
                  </button>
                ))}
              </div>
              <div className="pos__pay-labels">
                <span>Cash</span><span>GCASH</span><span>Union Bank</span>
              </div>
            </div>

            <div className="pos__panel-footer">
              <button className="pos__place-order" onClick={handlePlaceOrder}>Place order</button>
            </div>
          </aside>
        </div>
      </div>

      {modal === 'confirm' && (
        <ConfirmOrderModal
          customerName={customerName} cart={cart} paymentMethod={paymentMethod}
          subtotal={subtotal} tax={0} discount={0} total={total}
          onEdit={() => { setModal(null); setEditMode(true); }}
          onConfirm={handleConfirmOrder}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'payref' && (
        <div className="pos__overlay">
          <div className="pos__payref-modal" style={{ position:'relative' }}>
            <button
              onClick={() => setModal(null)}
              style={{
                position:'absolute', top:12, right:12,
                width:28, height:28, borderRadius:'50%',
                border:'0.5px solid #D9D9D9', background:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', transition:'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <span className="material-icons" style={{ fontSize:16, color:'#1C1B1F' }}>close</span>
            </button>

            <h2 className="pos__payref-title">Payment Confirmation</h2>
            <p className="pos__payref-sub">
              {paymentMethod === 'GCash' ? 'GCash' : 'Union Bank'} payment selected.
              Enter the reference number to mark this order as <strong>To Ship</strong>,
              or click <strong>Later</strong> to keep it as <strong>Reserved</strong>.
            </p>

            <div style={{
              display:'flex', alignItems:'center', gap:8,
              background:'rgba(0,0,0,0.04)', borderRadius:8,
              padding:'8px 12px', marginBottom:12, fontSize:12,
            }}>
              <span className="material-icons" style={{ fontSize:16, color:'rgba(0,0,0,0.4)' }}>
                {paymentMethod === 'GCash' ? 'qr_code_scanner' : 'add_card'}
              </span>
              <span style={{ color:'rgba(0,0,0,0.5)' }}>Payment via:</span>
              <span style={{ fontWeight:700 }}>{paymentMethod}</span>
            </div>

            <input
              className="pos__payref-input"
              placeholder="Enter Payment Reference Number"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />

            <div style={{ fontSize:11, color:'rgba(0,0,0,0.4)', marginBottom:16, marginTop:4 }}>
              {paymentRef.trim()
                ? '✓ With reference → order will be marked as To Ship'
                : '⏳ Without reference → order stays Reserved until paid'}
            </div>

            <div className="pos__payref-actions">
              <button
                className="pos__payref-confirm-btn"
                onClick={handleSubmitReference}
                disabled={!paymentRef.trim()}
                style={{ opacity: paymentRef.trim() ? 1 : 0.5, cursor: paymentRef.trim() ? 'pointer' : 'not-allowed' }}
              >
                Confirm Payment
              </button>
              <button className="pos__payref-later-btn" onClick={handlePayLater}>
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({ product, sel, onSel, onAdd }) {
  // ✅ FIX: p.set and p.size are arrays of populated objects
  const sets     = product.set  || [];
  const sizes    = product.size || [];
  const setRows  = chunk(sets,  4);
  const sizeRows = chunk(sizes, 5);

  return (
    <div className="pos__card">
      <div className="pos__card-top">
        <div className="pos__card-img-wrap">
          <img
            src={product.images?.[0] || ''}
            alt={product.name}
            className="pos__card-img"
            onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.classList.add('pos__card-img-wrap--ph'); }}
          />
        </div>
        <div className="pos__card-info">
          <p className="pos__card-name">{product.name}</p>
          <p className="pos__card-brand">{product.productCode}</p>

          <div className="pos__sel-grp">
            <div className="pos__sel-hdr">
              <span className="pos__sel-label">Type / Set</span>
              <span className="pos__sel-stock">Stock: {product.stock ?? 0}</span>
            </div>
            {setRows.map((row, ri) => (
              <div key={ri} className="pos__sel-row">
                {row.map((s) => (
                  <button
                    key={s._id}
                    className={`pos__sel-btn pos__sel-btn--type${sel?.set === s.name ? ' pos__sel-btn--on' : ''}`}
                    onClick={() => onSel('set', s.name)}
                  >{s.name}</button>
                ))}
              </div>
            ))}
          </div>

          <div className="pos__sel-grp">
            <div className="pos__sel-hdr">
              <span className="pos__sel-label">Size</span>
            </div>
            {sizeRows.map((row, ri) => (
              <div key={ri} className="pos__sel-row">
                {row.map((s) => (
                  <button
                    key={s._id}
                    className={`pos__sel-btn pos__sel-btn--size${sel?.size === s.name ? ' pos__sel-btn--on' : ''}`}
                    onClick={() => onSel('size', s.name)}
                  >{s.name}</button>
                ))}
              </div>
            ))}
          </div>

          <div className="pos__card-qty-area">
            {product.slot > 0 && <p className="pos__card-min">minimum of {product.slot} per order</p>}
            <div className="pos__card-qty-row">
              <span className="pos__card-qty-label">Quantity:</span>
              <div className="pos__card-stepper">
                <button onClick={() => onSel('qty', Math.max(product.slot || 1, (sel?.qty || product.slot || 1) - 1))}>−</button>
                <span>{sel?.qty || product.slot || 1}</span>
                <button onClick={() => onSel('qty', (sel?.qty || product.slot || 1) + 1)}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pos__card-bottom">
        <div className="pos__card-price-block">
          <div className="pos__card-price-row-inner">
            <span className="pos__card-price-sym">P</span>
            <span className="pos__card-price-val">{Number(product.wholesalePrice).toLocaleString()}.00</span>
          </div>
          <div className="pos__card-meta">
            <span className="pos__card-stock-lbl">Stock: {product.stock ?? 0}</span>
            <span className="pos__card-pcs">{product.quantityPerPack ?? 0} pcs per pack</span>
          </div>
        </div>
        <button className="pos__card-add-btn" onClick={onAdd}>Add Order</button>
      </div>
    </div>
  );
}

// ─── ConfirmOrderModal ────────────────────────────────────────────────────────

function ConfirmOrderModal({ customerName, cart, paymentMethod, subtotal, total, onEdit, onConfirm, onClose }) {
  return (
    <div className="pos__overlay">
      <div className="pos__cm" style={{ position:'relative' }}>
        <button
          onClick={onClose}
          style={{
            position:'absolute', top:12, right:12,
            width:28, height:28, borderRadius:'50%',
            border:'0.5px solid #D9D9D9', background:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', transition:'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          <span className="material-icons" style={{ fontSize:16, color:'#1C1B1F' }}>close</span>
        </button>

        <h2 className="pos__cm-title">Customer Information</h2>
        <div className="pos__cm-bill">
          <span className="pos__cm-bill-label">Bill To:</span>
          <div className="pos__cm-bill-val">{customerName}</div>
        </div>
        <h3 className="pos__cm-sec">Order Details</h3>
        <div className="pos__cm-items">
          {cart.map((item) => (
            <div key={item.id} className="pos__cm-item">
              <div className="pos__cm-img-wrap">
                <img src={item.img} alt={item.name} className="pos__cm-img" onError={(e) => (e.target.style.display = 'none')} />
              </div>
              <div className="pos__cm-item-info">
                <p className="pos__cm-item-name">{item.name}</p>
                <p className="pos__cm-item-var">
                  {item.set}
                  {item.size && ` · Size: ${item.size}`}
                </p>
                <p className="pos__cm-item-price">P {item.price.toLocaleString()}.00</p>
                <span className="pos__cm-item-qty">{item.qty} {item.qty === 1 ? 'piece' : 'pieces'}</span>
              </div>
              <p className="pos__cm-item-total">P {(item.price * item.qty).toLocaleString()}.00</p>
            </div>
          ))}
        </div>
        <h3 className="pos__cm-sec">Order Summary</h3>
        <div className="pos__cm-summary">
          <div className="pos__cm-sum-row"><span>Sub Total</span><span>P{subtotal.toLocaleString()}.00</span></div>
          <div className="pos__cm-sum-row"><span>Tax</span><span>P0.00</span></div>
          <div className="pos__cm-sum-row"><span>Discount</span><span>P0.00</span></div>
          <hr className="pos__cm-line" />
          <div className="pos__cm-sum-total"><span>TOTAL AMOUNT</span><span>P {total.toLocaleString()}.00</span></div>
        </div>
        <div className="pos__cm-payment">
          <span className="pos__cm-pay-label">Payment Method:</span>
          <span className="pos__cm-pay-val">{paymentMethod}</span>
        </div>

        {paymentMethod !== 'Cash' && (
          <div style={{
            background: 'rgba(147,197,253,0.15)',
            border:     '1px solid rgba(147,197,253,0.5)',
            borderRadius: 8,
            padding:    '8px 12px',
            fontSize:   11,
            color:      'rgba(0,0,0,0.55)',
            marginBottom: 12,
          }}>
            💡 You'll be asked for the payment reference number next. You can also submit it later in Transactions.
          </div>
        )}

        <div className="pos__cm-actions">
          <button className="pos__cm-edit-btn" onClick={onEdit}>Edit</button>
          <button className="pos__cm-confirm-btn" onClick={onConfirm}>Confirm Order</button>
        </div>
      </div>
    </div>
  );
}
