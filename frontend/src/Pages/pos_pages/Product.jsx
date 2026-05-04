import React, { useState, useMemo, useRef, useEffect } from 'react';
import Topbar from '../../Components/notif/Topbar';
import './Product.css';

const PRICE_PRESETS = [
  { label: '100-300',  min: 100,  max: 300  },
  { label: '300-600',  min: 300,  max: 600  },
  { label: '600-1000', min: 600,  max: 1000 },
];

const STATUS_META = {
  out: { label: 'Out of Stock', bg: 'rgba(159,0,3,0.12)',    border: 'rgba(159,0,3,0.35)',    dot: '#750010' },
  low: { label: 'Low Stock',    bg: 'rgba(13,13,187,0.10)',  border: 'rgba(13,13,187,0.35)',  dot: '#0D0DBB' },
  in:  { label: 'In Stock',     bg: 'rgba(112,233,90,0.15)', border: 'rgba(112,233,90,0.45)', dot: '#3DB82B' },
};

const BLANK_FORM = {
  code: '', name: '', description: '',
  sizes: [], sets: [],
  sellingPrice: '', retailPrice: '',
  minSlot: '', packQty: '',
  stockQty: '',
  category: '',
  images: [],
  mainImageIdx: 0,
};

const API_BASE = `${import.meta.env.VITE_API_URL}`;

const toggleArr = (arr, val) =>
  arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

const imgUrl = (img) => (typeof img === 'string' ? img : img?.url ?? null);

const ALERT_META = {
  success: { icon: 'check',   iconColor: '#3DB82B', circleBg: 'rgba(112,233,90,0.15)', circleBorder: 'rgba(112,233,90,0.45)', btnBg: '#3DB82B' },
  error:   { icon: 'close',   iconColor: '#c0392b', circleBg: 'rgba(192,57,43,0.10)',  circleBorder: 'rgba(192,57,43,0.35)', btnBg: '#c0392b' },
  warning: { icon: 'warning', iconColor: '#e67e22', circleBg: 'rgba(230,126,34,0.10)', circleBorder: 'rgba(230,126,34,0.35)', btnBg: '#e67e22' },
};

function AlertModal({ type, title, message, btnLabel = 'OK', onClose }) {
  if (!type) return null;
  const meta = ALERT_META[type] || ALERT_META.error;
  return (
    <div className="pmodal__overlay" style={{ zIndex: 9999 }}>
      <div className="pmodal__delete-box scale-in">
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: meta.circleBg, border: `2px solid ${meta.circleBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span className="material-icons" style={{ fontSize: 36, color: meta.iconColor }}>{meta.icon}</span>
        </div>
        <h2 className="pmodal__delete-title">{title}</h2>
        <p className="pmodal__delete-msg">{message}</p>
        <div className="pmodal__delete-actions" style={{ justifyContent: 'center' }}>
          <button className="pmodal__submit-btn" style={{ background: meta.btnBg }} onClick={onClose}>{btnLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function Product() {
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [lowStockQty,    setLowStockQty]    = useState(10);

  const [availableSizes,      setAvailableSizes]      = useState([]);
  const [availableSets,       setAvailableSets]       = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);

  const [filterOpen,       setFilterOpen]       = useState(false);
  const [filterSizes,      setFilterSizes]      = useState([]);
  const [filterCategories, setFilterCategories] = useState([]);
  const [priceMin,         setPriceMin]         = useState('');
  const [priceMax,         setPriceMax]         = useState('');
  const [pricePreset,      setPricePreset]      = useState(null);
  const [statusFilter,     setStatusFilter]     = useState('all');
  const [statusDropOpen,   setStatusDropOpen]   = useState(false);
  const filterRef   = useRef(null);
  const statusThRef = useRef(null);

  const [modal,      setModal]      = useState(null);
  const [form,       setForm]       = useState(BLANK_FORM);
  const [editId,     setEditId]     = useState(null);
  const [hoveredImg, setHoveredImg] = useState(false);

  const [uploadError, setUploadError] = useState('');
  const [alertModal,  setAlertModal]  = useState(null);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({ type, title, message, btnLabel, onClose: onClose ?? (() => setAlertModal(null)) });
  };

  const stockStatus = (qty, threshold = lowStockQty) => {
    const n = Number(qty) || 0;
    return n <= 0 ? 'out' : n <= threshold ? 'low' : 'in';
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [sizesRes, setsRes, catsRes, lowStockRes, productsRes] = await Promise.all([
          fetch(`${API_BASE}/api/sizes`),
          fetch(`${API_BASE}/api/sets`),
          fetch(`${API_BASE}/api/productcategory`),
          fetch(`${API_BASE}/api/lowstocksetting`),
          fetch(`${API_BASE}/api/products?showAll=true`),
        ]);
        const sizesData    = await sizesRes.json();
        const setsData     = await setsRes.json();
        const catsData     = await catsRes.json();
        const lowStockData = await lowStockRes.json();
        const productsData = await productsRes.json();

        const threshold = lowStockData?.lowStockQty || 10;
        setLowStockQty(threshold);
        setAvailableSizes(Array.isArray(sizesData) ? sizesData : []);
        setAvailableSets(Array.isArray(setsData)   ? setsData  : []);
        setAvailableCategories(Array.isArray(catsData) ? catsData : []);

        const normalized = productsData.map((p) => ({
          ...p, id: p._id, status: stockStatus(p.stock, threshold),
        }));
        setProducts(normalized);
      } catch (err) {
        console.error('Failed to init:', err);
        showAlert('error', 'Failed to Load', 'Could not load products. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/api/products?showAll=true`);
      const data = await res.json();
      const normalized = data.map((p) => ({
        ...p, id: p._id, status: stockStatus(p.stock),
      }));
      setProducts(normalized);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      showAlert('error', 'Refresh Failed', 'Could not reload products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current   && !filterRef.current.contains(e.target))   setFilterOpen(false);
      if (statusThRef.current && !statusThRef.current.contains(e.target)) setStatusDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const categoryTabs = useMemo(() => {
    const names = availableCategories.map(c => c.name ?? c);
    return ['All', ...names];
  }, [availableCategories]);

  const hasActiveFilters = filterSizes.length > 0 || filterCategories.length > 0
    || priceMin || priceMax || pricePreset || statusFilter !== 'all';

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat      = activeCategory === 'All' || p.category === activeCategory;
      const matchQ        = !searchQuery ||
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productCode?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSize     = filterSizes.length === 0 ||
        (Array.isArray(p.size) && p.size.some(s => filterSizes.includes(s?._id ?? s)));
      const matchPanelCat = filterCategories.length === 0 || filterCategories.includes(p.category);
      const matchStatus   = statusFilter === 'all' || p.status === statusFilter;
      const minVal        = priceMin ? Number(priceMin) : null;
      const maxVal        = priceMax ? Number(priceMax) : null;
      const matchPrice    = (!minVal || p.retailPrice >= minVal) && (!maxVal || p.retailPrice <= maxVal);
      return matchCat && matchQ && matchSize && matchPanelCat && matchPrice && matchStatus;
    });
  }, [products, activeCategory, searchQuery, filterSizes, filterCategories, priceMin, priceMax, statusFilter]);

  const toggleFilterSize = (id) =>
    setFilterSizes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleFilterCat = (name) =>
    setFilterCategories(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

  const selectPreset = (label) => {
    if (pricePreset === label) {
      setPricePreset(null); setPriceMin(''); setPriceMax('');
    } else {
      const preset = PRICE_PRESETS.find(pr => pr.label === label);
      if (preset) { setPricePreset(label); setPriceMin(String(preset.min)); setPriceMax(String(preset.max)); }
    }
  };

  const clearAllFilters = () => {
    setFilterSizes([]); setFilterCategories([]);
    setPriceMin(''); setPriceMax(''); setPricePreset(null);
    setStatusFilter('all');
  };

  const handleImgUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const blobUrls = files.map((file) => ({ url: URL.createObjectURL(file), uploading: false, file }));
    setForm((prev) => ({ ...prev, images: [...prev.images, ...blobUrls] }));
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setForm((prev) => {
      const img = prev.images[idx];
      if (img?.file) URL.revokeObjectURL(img.url);
      const updated = prev.images.filter((_, i) => i !== idx);
      return { ...prev, images: updated, mainImageIdx: Math.min(prev.mainImageIdx, Math.max(0, updated.length - 1)) };
    });
  };

  const openAdd = () => { setForm(BLANK_FORM); setEditId(null); setUploadError(''); setModal('add'); };

  const openEdit = (product) => {
    setEditId(product._id ?? product.id);
    setUploadError('');
    setForm({
      code:         product.productCode        ?? product.code ?? '',
      name:         product.name               ?? '',
      description:  product.productDescription ?? product.description ?? '',
      sizes:        (product.size ?? []).map(s => String(s?._id ?? s)),
      sets:         (product.set  ?? []).map(s => String(s?._id ?? s)),
      sellingPrice: product.wholesalePrice  ?? '',
      retailPrice:  product.retailPrice     ?? '',
      minSlot:      product.slot            ?? '',
      packQty:      product.quantityPerPack ?? '',
      stockQty:     product.stock           ?? '',
      category:     product.category        ?? '',
      images:       (product.images ?? []).map(u =>
        typeof u === 'string' ? { url: u, uploading: false } : u
      ),
      mainImageIdx: 0,
    });
    setModal('edit');
  };

  const closeAll = () => { setModal(null); setEditId(null); setUploadError(''); };

  const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

  const handleProceedToConfirm = () => {
    if (isEmpty(form.code)) {
      showAlert('warning', 'Required Field', 'Product Code is required.'); return;
    }
    if (isEmpty(form.name)) {
      showAlert('warning', 'Required Field', 'Product Name is required.'); return;
    }
    if (isEmpty(form.description)) {
      showAlert('warning', 'Required Field', 'Product Description is required.'); return;
    }
    if (form.sizes.length === 0) {
      showAlert('warning', 'Required Field', 'Please select at least one Size.'); return;
    }
    if (form.sets.length === 0) {
      showAlert('warning', 'Required Field', 'Please select at least one Set.'); return;
    }
    if (isEmpty(form.minSlot)) {
      showAlert('warning', 'Required Field', 'Slot Availability is required.'); return;
    }
    if (isEmpty(form.packQty)) {
      showAlert('warning', 'Required Field', 'Packs per Slot is required.'); return;
    }
    if (isEmpty(form.sellingPrice) || Number(form.sellingPrice) <= 0) {
      showAlert('warning', 'Required Field', 'Selling Price must be greater than 0.'); return;
    }
    if (isEmpty(form.retailPrice) || Number(form.retailPrice) <= 0) {
      showAlert('warning', 'Required Field', 'Retail Price must be greater than 0.'); return;
    }
    if (isEmpty(form.category)) {
      showAlert('warning', 'Required Field', 'Product Category is required.'); return;
    }
    if (isEmpty(form.stockQty)) {
      showAlert('warning', 'Required Field', 'Stock Quantity is required.'); return;
    }
    setModal('confirm');
  };

  const uploadImagesToServer = async () => {
    const existingUrls  = form.images.filter(img => !img.file).map(img => img.url);
    const filesToUpload = form.images.filter(img => img.file).map(img => img.file);
    if (filesToUpload.length === 0) return existingUrls;

    const formData = new FormData();
    filesToUpload.forEach(file => formData.append('images', file));

    const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Image upload failed');

    const data = await res.json();
    return [...existingUrls, ...data.urls];
  };

  const handleConfirm = async () => {
    try {
      const imageUrls = await uploadImagesToServer();

      const payload = {
        images:             imageUrls,
        productCode:        form.code,
        name:               form.name,
        productDescription: form.description,
        size:               form.sizes,
        set:                form.sets,
        slot:               Number(form.minSlot)  || 0,
        quantityPerPack:    Number(form.packQty)  || 0,
        wholesalePrice:     Number(form.sellingPrice) || 0,
        retailPrice:        Number(form.retailPrice)  || 0,
        category:           form.category,
        stock:              Number(form.stockQty) || 0,
      };

      const url    = editId ? `${API_BASE}/api/products/${editId}` : `${API_BASE}/api/products`;
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        const serverMsg = err.message ?? '';
        if (serverMsg.includes('E11000') && serverMsg.includes('productCode')) {
          showAlert('error', 'Duplicate Product Code', `The product code "${form.code}" is already in use. Please use a different code.`);
        } else if (serverMsg.includes('E11000')) {
          showAlert('error', 'Duplicate Entry', 'A product with that information already exists. Please check your entries and try again.');
        } else if (serverMsg.includes('validation')) {
          showAlert('error', 'Validation Error', 'Some fields are invalid. Please review the form and try again.');
        } else {
          showAlert('error', 'Save Failed', serverMsg || 'Could not save the product. Please try again.');
        }
        return;
      }

      const saved      = await res.json();
      const normalized = { ...saved, id: saved._id, status: stockStatus(saved.stock) };

      if (editId) {
        setProducts((prev) => prev.map((p) => p.id === editId ? normalized : p));
      } else {
        setProducts((prev) => [...prev, normalized]);
      }

      closeAll();
      showAlert(
        'success',
        editId ? 'Product Updated!' : 'Product Added!',
        editId
          ? 'The product details have been saved successfully. All changes are now reflected in the inventory.'
          : 'New product has been added to your inventory and is now available for sales.',
        'Done'
      );
    } catch (err) {
      console.error('Save product error:', err);
      if (err.message === 'Image upload failed') {
        showAlert('error', 'Upload Failed', 'One or more images could not be uploaded. Please try again.');
      } else {
        showAlert('error', 'Connection Error', 'Something went wrong. Please check your connection and try again.');
      }
    }
  };

  const handleToggleStatus = async (id, currentIsActive) => {
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Toggle failed');
      const { product } = await res.json();
      setProducts(prev => prev.map(p =>
        (p._id ?? p.id) === id
          ? { ...p, isActive: product.isActive, status: stockStatus(product.stock) }
          : p
      ));
      closeAll();
      showAlert(
        'warning',
        product.isActive ? 'Product Activated!' : 'Product Deactivated!',
        product.isActive
          ? 'The product is now visible and available in the POS and orders.'
          : 'The product has been hidden from the POS and orders. You can reactivate it anytime.',
        'Done'
      );
    } catch (err) {
      showAlert('error', 'Update Failed', 'Could not update the product status. Please try again.');
    }
  };

  return (
    <div className="product-page">

      {alertModal && (
        <AlertModal
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          btnLabel={alertModal.btnLabel}
          onClose={alertModal.onClose}
        />
      )}

      <div className="product-page__header">
        <div className="product-page__title-block">
          <h1 className="product-page__title">PRODUCT</h1>
          <p className="product-page__subtitle">Monitor stock levels and manage your product listings</p>
        </div>
        <Topbar />
      </div>

      <div className="product-page__toolbar">
        <div className="product-page__cat-bar">
          {categoryTabs.map((cat) => (
            <button
              key={cat}
              className={`product-page__cat-btn ${activeCategory === cat ? 'product-page__cat-btn--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >{cat}</button>
          ))}
        </div>

        <div className="product-page__toolbar-right">
          <div className="product-page__search-wrap">
            <span className="material-icons product-page__search-icon">search</span>
            <input
              className="product-page__search"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="product-page__sort-wrap" ref={filterRef}>
            <button
              className={`product-page__filter-btn ${filterOpen ? 'product-page__filter-btn--open' : ''}`}
              onClick={() => setFilterOpen(o => !o)}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>filter_list</span>
              Filter
              {hasActiveFilters && <span className="product-page__filter-dot" />}
              <span className="material-icons product-page__filter-arrow">
                {filterOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
              </span>
            </button>

            {filterOpen && (
              <div className="product-page__filter-panel">
                <div className="product-page__fp-header">
                  <span className="product-page__fp-title">Filter</span>
                  {hasActiveFilters && (
                    <button className="product-page__fp-clear" onClick={clearAllFilters}>Clear All</button>
                  )}
                </div>
                <div className="product-page__fp-section">
                  <p className="product-page__fp-section-title">By Size</p>
                  <div className="product-page__fp-size-grid">
                    {availableSizes.map(s => (
                      <button
                        key={s._id}
                        className={`product-page__fp-size-chip ${filterSizes.includes(s._id) ? 'product-page__fp-chip--active' : ''}`}
                        onClick={() => toggleFilterSize(s._id)}
                      >{s.name}</button>
                    ))}
                  </div>
                </div>
                <div className="product-page__fp-section">
                  <p className="product-page__fp-section-title">By Category</p>
                  <div className="product-page__fp-cat-grid">
                    {availableCategories.length === 0 ? (
                      <span style={{ fontSize: 11, color: '#aaa' }}>Loading…</span>
                    ) : (
                      availableCategories.map(c => {
                        const name = c.name ?? c;
                        return (
                          <button
                            key={c._id ?? name}
                            className={`product-page__fp-cat-chip ${filterCategories.includes(name) ? 'product-page__fp-chip--active' : ''}`}
                            onClick={() => toggleFilterCat(name)}
                          >{name}</button>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="product-page__fp-section">
                  <p className="product-page__fp-section-title">Price Range</p>
                  <div className="product-page__fp-price-inputs">
                    <input className="product-page__fp-price-input" placeholder="MIN" value={priceMin}
                      onChange={e => { setPriceMin(e.target.value); setPricePreset(null); }} />
                    <div className="product-page__fp-price-dash" />
                    <input className="product-page__fp-price-input" placeholder="MAX" value={priceMax}
                      onChange={e => { setPriceMax(e.target.value); setPricePreset(null); }} />
                  </div>
                  <div className="product-page__fp-preset-row">
                    {PRICE_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        className={`product-page__fp-preset-chip ${pricePreset === preset.label ? 'product-page__fp-chip--active' : ''}`}
                        onClick={() => selectPreset(preset.label)}
                      >{preset.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="product-page__card">
        <div className="product-page__card-top-row">
          <p className="product-page__count">
            Total Product: <strong>{filtered.length}</strong> item{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="product-page__card-actions">
            {hasActiveFilters && (
              <div className="product-page__sort-active-badge">
                <span className="material-icons" style={{ fontSize: 13 }}>filter_list</span>
                Filters active
                <button className="product-page__sort-clear" onClick={clearAllFilters}>
                  <span className="material-icons" style={{ fontSize: 13 }}>close</span>
                </button>
              </div>
            )}
            <button className="product-page__add-btn" onClick={openAdd}>
              <span className="product-page__add-btn-plus">+</span>
              Add Product
            </button>
          </div>
        </div>

        <div className="product-page__table-wrap">
          <table className="product-page__table">
            <thead>
              <tr className="product-page__thead-row">
                <th>No.</th>
                <th>Product ID</th>
                <th>Product img</th>
                <th>Product Name</th>
                <th>Size</th>
                <th>Packs/Slot</th>
                <th>Stock</th>
                <th>Unit Price</th>
                <th>Price Per Pack</th>
                <th
                  ref={statusThRef}
                  className="product-page__th-status"
                  onClick={() => setStatusDropOpen(o => !o)}
                >
                  <span className="product-page__th-status-inner">
                    Status
                    {statusFilter !== 'all' && (
                      <span className="product-page__th-status-dot" style={{ background: STATUS_META[statusFilter]?.dot }} />
                    )}
                    <span className={`material-icons product-page__th-arrow ${statusDropOpen ? 'product-page__th-arrow--open' : ''}`}>
                      arrow_drop_down
                    </span>
                  </span>
                  {statusDropOpen && (
                    <div className="product-page__status-header-drop" onClick={e => e.stopPropagation()}>
                      <div
                        className={`product-page__status-drop-option ${statusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => { setStatusFilter('all'); setStatusDropOpen(false); }}
                      >
                        <span className="product-page__status-all-dot" />All
                      </div>
                      {Object.entries(STATUS_META).map(([key, meta]) => (
                        <div
                          key={key}
                          className={`product-page__status-drop-option ${statusFilter === key ? 'active' : ''}`}
                          onClick={() => { setStatusFilter(key); setStatusDropOpen(false); }}
                        >
                          <span className="product-page__status-drop-dot" style={{ background: meta.dot }} />
                          {meta.label}
                        </div>
                      ))}
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(0,0,0,0.4)' }}>
                    Loading products…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(0,0,0,0.35)', fontStyle: 'italic' }}>
                    No products found.
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const sm         = STATUS_META[p.status] || STATUS_META.in;
                  const firstImg   = imgUrl(p.images?.[0]);
                  const sizeLabels = (p.size ?? []).map(s => s?.name ?? s).join(', ');
                  return (
                    <tr
                      key={p._id ?? p.id}
                      className="product-page__row product-page__row--clickable"
                      onClick={() => openEdit(p)}
                      title="Click to edit this product"
                      style={{ opacity: p.isActive === false ? 0.20 : 1 }}
                    >
                      <td className="product-page__td product-page__td--no">{i + 1}</td>
                      <td className="product-page__td product-page__td--code">{p.productCode ?? p.code}</td>
                      <td className="product-page__td">
                        <div className="product-page__img-cell">
                          {firstImg
                            ? <img src={firstImg} alt={p.name} className="product-page__img" />
                            : <div className="product-page__img-placeholder">
                                <span className="material-icons" style={{ fontSize: 28, color: '#ccc' }}>image</span>
                              </div>
                          }
                        </div>
                      </td>
                      <td className="product-page__td">{p.name}</td>
                      <td className="product-page__td">{sizeLabels || '—'}</td>
                      <td className="product-page__td">{p.quantityPerPack ?? '—'}</td>
                      <td className="product-page__td">{p.stock ?? 0}</td>
                      <td className="product-page__td">₱ {(p.retailPrice ?? 0).toLocaleString()}</td>
                      <td className="product-page__td">₱ {(p.wholesalePrice ?? p.pricePerPack ?? 0).toLocaleString()}</td>
                      <td className="product-page__td" onClick={e => e.stopPropagation()}>
                        <span
                          className="product-page__status-badge"
                          style={{ background: sm.bg, border: `0.5px solid ${sm.border}` }}
                        >
                          <span className="product-page__status-dot" style={{ background: sm.dot }} />
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="pmodal__overlay">
          <div className="pmodal__box scale-in">
            <button className="pmodal__close" onClick={closeAll}>
              <span className="material-icons">close</span>
            </button>
            <h2 className="pmodal__title">{modal === 'edit' ? 'Edit Product' : 'Add Product'}</h2>
            <div className="pmodal__body">
              <div className="pmodal__left">
                <h3 className="pmodal__section-label">Product Information</h3>
                <div className="pmodal__info-card">
                  <div className="pmodal__field">
                    <label className="pmodal__field-label">Product Code: <span className="pmodal__required">*</span></label>
                    <input className="pmodal__input pmodal__input--sm" placeholder="Item Code"
                      value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} />
                  </div>
                  <div className="pmodal__field">
                    <label className="pmodal__field-label">Product Name: <span className="pmodal__required">*</span></label>
                    <input className="pmodal__input pmodal__input--full" placeholder="Item Name"
                      value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="pmodal__field">
                    <label className="pmodal__field-label">Product Description: <span className="pmodal__required">*</span></label>
                    <textarea className="pmodal__textarea" placeholder="Item Description"
                      value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="pmodal__field">
                    <label className="pmodal__field-label">Size: <span className="pmodal__required">*</span></label>
                    <p className="pmodal__pick-hint">Pick Available Size</p>
                    <div className="pmodal__chip-row">
                      {availableSizes.length === 0
                        ? <span style={{ fontSize: 11, color: '#aaa' }}>Loading sizes…</span>
                        : availableSizes.map((s) => (
                          <button key={s._id} type="button"
                            className={`pmodal__chip pmodal__chip--size ${form.sizes.includes(String(s._id)) ? 'pmodal__chip--active' : ''}`}
                            onClick={() => setForm(f => ({ ...f, sizes: toggleArr(f.sizes, String(s._id)) }))}
                          >{s.name}</button>
                        ))
                      }
                    </div>
                  </div>
                  <div className="pmodal__field">
                    <label className="pmodal__field-label">Set: <span className="pmodal__required">*</span></label>
                    <p className="pmodal__pick-hint">Pick Available Set</p>
                    <div className="pmodal__chip-row">
                      {availableSets.length === 0
                        ? <span style={{ fontSize: 11, color: '#aaa' }}>Loading sets…</span>
                        : availableSets.map((s) => (
                          <button key={s._id} type="button"
                            className={`pmodal__chip pmodal__chip--set ${form.sets.includes(String(s._id)) ? 'pmodal__chip--active' : ''}`}
                            onClick={() => setForm(f => ({ ...f, sets: toggleArr(f.sets, String(s._id)) }))}
                          >{s.name}</button>
                        ))
                      }
                    </div>
                  </div>
                </div>

                <div className="pmodal__pricing-row">
                  <h3 className="pmodal__section-label pmodal__section-label--inline">Pricing</h3>
                  <div className="pmodal__pricing-card">
                    <div className="pmodal__sub-field">
                      <label className="pmodal__sub-label">Slot Availability: <span className="pmodal__required">*</span></label>
                      <input className="pmodal__sub-input" placeholder="How many people can avail"
                        value={form.minSlot} onChange={(e) => setForm(f => ({ ...f, minSlot: e.target.value }))} />
                    </div>
                    <div className="pmodal__sub-field">
                      <label className="pmodal__sub-label">Packs per Slot: <span className="pmodal__required">*</span></label>
                      <input className="pmodal__sub-input" placeholder="How many packs per slot"
                        value={form.packQty} onChange={(e) => setForm(f => ({ ...f, packQty: e.target.value }))} />
                    </div>
                    <div className="pmodal__price-fields">
                      <div className="pmodal__sub-field">
                        <label className="pmodal__sub-label">Selling Price: <span className="pmodal__required">*</span></label>
                        <input className="pmodal__price-input" placeholder="Wholesale Price"
                          value={form.sellingPrice} onChange={(e) => setForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                      </div>
                      <div className="pmodal__sub-field">
                        <label className="pmodal__sub-label">Retail Price: <span className="pmodal__required">*</span></label>
                        <input className="pmodal__price-input" placeholder="Retail Price"
                          value={form.retailPrice} onChange={(e) => setForm(f => ({ ...f, retailPrice: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pmodal__right">
                <h3 className="pmodal__section-label">Product Image</h3>
                <div className="pmodal__img-card">
                  {uploadError && (
                    <p style={{ color: '#c00', fontSize: 12, marginBottom: 6 }}>{uploadError}</p>
                  )}
                  <div
                    className={`pmodal__main-img-wrap ${hoveredImg ? 'pmodal__main-img-wrap--hover' : ''}`}
                    onMouseEnter={() => setHoveredImg(true)}
                    onMouseLeave={() => setHoveredImg(false)}
                  >
                    {form.images.length > 0 ? (
                      <>
                        {form.images[form.mainImageIdx]?.uploading ? (
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:8 }}>
                            <span className="material-icons" style={{ fontSize:32, color:'#aaa', animation:'spin 1s linear infinite' }}>autorenew</span>
                            <span style={{ fontSize:11, color:'#aaa' }}>Uploading…</span>
                          </div>
                        ) : (
                          <img src={imgUrl(form.images[form.mainImageIdx])} alt="main" className="pmodal__main-img" />
                        )}
                        {hoveredImg && !form.images[form.mainImageIdx]?.uploading && (
                          <div className="pmodal__img-overlay">
                            <label className="pmodal__img-overlay-btn pmodal__img-overlay-btn--replace">
                              Replace
                              <input type="file" accept="image/*" hidden onChange={handleImgUpload} />
                            </label>
                            <button className="pmodal__img-overlay-btn pmodal__img-overlay-btn--remove" onClick={() => removeImage(form.mainImageIdx)}>Remove</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <label className="pmodal__upload-label">
                        <span className="material-icons pmodal__upload-icon">add_photo_alternate</span>
                        <span className="pmodal__upload-hint">drop your image here or click to browse</span>
                        <input type="file" accept="image/*" multiple hidden onChange={handleImgUpload} />
                      </label>
                    )}
                  </div>
                  <div className="pmodal__thumb-strip">
                    {[0, 1, 2].map((idx) => {
                      const img = form.images[idx];
                      return (
                        <div
                          key={idx}
                          className={`pmodal__thumb ${form.mainImageIdx === idx && img ? 'pmodal__thumb--active' : ''}`}
                          onClick={() => img && !img.uploading && setForm(f => ({ ...f, mainImageIdx: idx }))}
                        >
                          {img ? (
                            img.uploading
                              ? <span className="material-icons" style={{ fontSize:18, color:'#aaa', animation:'spin 1s linear infinite' }}>autorenew</span>
                              : <img src={imgUrl(img)} alt="" className="pmodal__thumb-img" />
                          ) : (
                            <label className="pmodal__thumb-upload">
                              <span className="material-icons" style={{ fontSize:14, color:'#999' }}>add_photo_alternate</span>
                              <input type="file" accept="image/*" hidden onChange={handleImgUpload} />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <h3 className="pmodal__section-label pmodal__section-label--mt">Category</h3>
                <div className="pmodal__cat-card">
                  <label className="pmodal__sub-label">Product Category: <span className="pmodal__required">*</span></label>
                  <div className="pmodal__select-wrap">
                    <select className="pmodal__select" value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">Select Category</option>
                      {availableCategories.map(c => {
                        const name = c.name ?? c;
                        return <option key={c._id ?? name} value={name}>{name}</option>;
                      })}
                    </select>
                    <span className="material-icons pmodal__select-arrow">keyboard_arrow_down</span>
                  </div>
                </div>

                <h3 className="pmodal__section-label pmodal__section-label--mt">Inventory</h3>
                <div className="pmodal__inv-card">
                  <label className="pmodal__sub-label">Stock Quantity: <span className="pmodal__required">*</span></label>
                  <input className="pmodal__inv-input" placeholder="Stock by Pack"
                    value={form.stockQty} onChange={(e) => setForm(f => ({ ...f, stockQty: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="pmodal__footer">
              <button className="pmodal__discard-btn" onClick={closeAll}>Discard</button>
              {modal === 'edit' && (
                <button
                  className={`pmodal__discard-btn ${
                    products.find(p => (p._id ?? p.id) === editId)?.isActive === false
                      ? 'pmodal__toggle-btn--activate'
                      : 'pmodal__toggle-btn--deactivate'
                  }`}
                  onClick={() => setModal('toggleConfirm')}
                >
                  <span className="material-icons" style={{ fontSize: 16 }}>
                    {products.find(p => (p._id ?? p.id) === editId)?.isActive === false ? 'visibility' : 'visibility_off'}
                  </span>
                  {products.find(p => (p._id ?? p.id) === editId)?.isActive === false ? 'Set Active' : 'Set Inactive'}
                </button>
              )}
              <button className="pmodal__submit-btn" onClick={handleProceedToConfirm}>
                {modal === 'edit' ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {modal === 'confirm' && (
        <div className="pmodal__overlay">
          <div className="pmodal__box scale-in">
            <button className="pmodal__close" onClick={closeAll}><span className="material-icons">close</span></button>
            <h2 className="pmodal__title">{editId !== null ? 'Confirm Changes' : 'Add Product'}</h2>
            <div className="pmodal__body">
              <div className="pmodal__left">
                <h3 className="pmodal__section-label">Product Information</h3>
                <div className="pmodal__info-card pmodal__info-card--readonly">
                  <div className="pmodal__field"><label className="pmodal__field-label">Product Code:</label><div className="pmodal__readonly-val">{form.code || '—'}</div></div>
                  <div className="pmodal__field"><label className="pmodal__field-label">Product Name:</label><div className="pmodal__readonly-val">{form.name || '—'}</div></div>
                  <div className="pmodal__field"><label className="pmodal__field-label">Description:</label><div className="pmodal__readonly-val pmodal__readonly-val--tall">{form.description || '—'}</div></div>
                  <div className="pmodal__field">
                    <label className="pmodal__field-label">Size:</label>
                    <div className="pmodal__chip-row">
                      {availableSizes.map((s) => (
                        <span key={s._id} className={`pmodal__chip pmodal__chip--size ${form.sizes.includes(String(s._id)) ? 'pmodal__chip--active' : ''}`}>{s.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="pmodal__field">
                    <label className="pmodal__field-label">Set:</label>
                    <div className="pmodal__chip-row">
                      {availableSets.map((s) => (
                        <span key={s._id} className={`pmodal__chip pmodal__chip--set ${form.sets.includes(String(s._id)) ? 'pmodal__chip--active' : ''}`}>{s.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pmodal__pricing-row">
                  <h3 className="pmodal__section-label pmodal__section-label--inline">Pricing</h3>
                  <div className="pmodal__pricing-card pmodal__pricing-card--readonly">
                    <div className="pmodal__price-readonly-row"><span className="pmodal__sub-label">Slot Availability:</span><span>{form.minSlot || '—'}</span></div>
                    <div className="pmodal__price-readonly-row"><span className="pmodal__sub-label">Packs per Slot:</span><span>{form.packQty || '—'}</span></div>
                    <div className="pmodal__price-readonly-row"><span className="pmodal__sub-label">Selling Price:</span><span>₱ {form.sellingPrice || '—'}</span></div>
                    <div className="pmodal__price-readonly-row"><span className="pmodal__sub-label">Retail Price:</span><span>₱ {form.retailPrice || '—'}</span></div>
                  </div>
                </div>
              </div>
              <div className="pmodal__right">
                <h3 className="pmodal__section-label">Product Image</h3>
                <div className="pmodal__img-card">
                  <div className="pmodal__main-img-wrap">
                    {form.images.length > 0 && imgUrl(form.images[0])
                      ? <img src={imgUrl(form.images[0])} alt="main" className="pmodal__main-img" />
                      : <div className="pmodal__upload-label pmodal__upload-label--empty">
                          <span className="material-icons" style={{ fontSize:30, color:'#ccc' }}>image</span>
                        </div>
                    }
                  </div>
                  <div className="pmodal__thumb-strip">
                    {[0,1,2].map((idx) => (
                      <div key={idx} className="pmodal__thumb">
                        {form.images[idx] && imgUrl(form.images[idx])
                          ? <img src={imgUrl(form.images[idx])} alt="" className="pmodal__thumb-img" />
                          : <span className="material-icons" style={{ fontSize:14, color:'#ccc' }}>image</span>
                        }
                      </div>
                    ))}
                  </div>
                </div>
                <h3 className="pmodal__section-label pmodal__section-label--mt">Category</h3>
                <div className="pmodal__cat-card"><div className="pmodal__readonly-val">{form.category || '—'}</div></div>
                <h3 className="pmodal__section-label pmodal__section-label--mt">Inventory</h3>
                <div className="pmodal__inv-card">
                  <label className="pmodal__sub-label">Stock Quantity:</label>
                  <div className="pmodal__readonly-val">{form.stockQty || '—'}</div>
                </div>
              </div>
            </div>
            <div className="pmodal__footer">
              <button className="pmodal__discard-btn" onClick={closeAll}>Discard</button>
              <button className="pmodal__secondary-btn" onClick={() => setModal(editId !== null ? 'edit' : 'add')}>Edit</button>
              <button className="pmodal__submit-btn" onClick={handleConfirm}>
                {editId !== null ? 'Confirm Changes' : 'Confirm Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOGGLE CONFIRM MODAL */}
      {modal === 'toggleConfirm' && (() => {
        const currentProduct    = products.find(p => (p._id ?? p.id) === editId);
        const isCurrentlyActive = currentProduct?.isActive !== false;
        return (
          <div className="pmodal__overlay">
            <div className="pmodal__delete-box scale-in">
              <span className="material-icons pmodal__delete-icon" style={{ color: isCurrentlyActive ? '#e67e22' : '#27ae60' }}>
                {isCurrentlyActive ? 'visibility_off' : 'visibility'}
              </span>
              <h2 className="pmodal__delete-title">
                {isCurrentlyActive ? 'Set Product Inactive?' : 'Set Product Active?'}
              </h2>
              <p className="pmodal__delete-msg">
                {isCurrentlyActive
                  ? 'This product will be hidden from orders and the POS. You can reactivate it anytime.'
                  : 'This product will be visible again in orders and the POS.'}
              </p>
              <div className="pmodal__delete-actions">
                <button className="pmodal__discard-btn" onClick={closeAll}>Cancel</button>
                <button
                  className="pmodal__submit-btn"
                  style={{ background: isCurrentlyActive ? '#e67e22' : '#27ae60' }}
                  onClick={() => { handleToggleStatus(editId, isCurrentlyActive); closeAll(); }}
                >
                  {isCurrentlyActive ? 'Yes, Set Inactive' : 'Yes, Set Active'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
