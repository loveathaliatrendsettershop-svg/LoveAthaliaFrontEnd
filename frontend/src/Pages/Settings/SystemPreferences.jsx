import Topbar from '../../Components/notif/Topbar'
import Sidebar from '../../Components/sidebar/Sidebar'
import React, { useState, useEffect } from "react"
import back from '../../Assets/back.png'
import './SystemPreferences.css'
import edit from '../../Assets/edit.png'
import sizechart from '../../Assets/sizechart.jpg'
import { useNavigate } from "react-router-dom";

const CATEGORY_API = `${import.meta.env.VITE_API_URL}/api/productcategory`;
const SIZE_API     = `${import.meta.env.VITE_API_URL}/api/sizes`;
const SET_API      = `${import.meta.env.VITE_API_URL}/api/sets`;
const SETTINGS_API = `${import.meta.env.VITE_API_URL}/api/overduesetting`;
const LOWSTOCK_API = `${import.meta.env.VITE_API_URL}/api/lowstocksetting`;

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
    <div className="pmodal__overlay">
      <div className="pmodal__delete-box scale-in">
        <div style={{ width:72, height:72, borderRadius:'50%', background:meta.circleBg, border:`2px solid ${meta.circleBorder}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
          <span className="material-icons" style={{ fontSize:36, color:meta.iconColor }}>{meta.icon}</span>
        </div>
        <h2 className="pmodal__delete-title">{title}</h2>
        <p className="pmodal__delete-msg">{message}</p>
        <div className="pmodal__delete-actions" style={{ justifyContent:'center' }}>
          <button className="pmodal__submit-btn" style={{ background:meta.btnBg }} onClick={onClose}>{btnLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="pmodal__overlay">
      <div className="pmodal__delete-box scale-in">
        <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(192,57,43,0.10)', border:'2px solid rgba(192,57,43,0.35)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
          <span className="material-icons" style={{ fontSize:36, color:'#c0392b' }}>delete</span>
        </div>
        <h2 className="pmodal__delete-title">{title}</h2>
        <p className="pmodal__delete-msg">{message}</p>
        <div className="pmodal__delete-actions">
          <button className="pmodal__discard-btn" onClick={onCancel}>Cancel</button>
          <button className="pmodal__submit-btn" style={{ background:'#c0392b' }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline save badge (same style as overdue/lowstock) ───────────────────────
function SaveBadge({ status }) {
  if (!status) return null;
  if (status === 'saved') return (
    <span style={{ fontSize:12, color:'#419E0B', marginLeft:8, display:'flex', alignItems:'center', gap:3 }}>
      <span className="material-icons" style={{ fontSize:14 }}>check_circle</span> Saved
    </span>
  );
  if (status === 'error') return (
    <span style={{ fontSize:12, color:'#990214', marginLeft:8, display:'flex', alignItems:'center', gap:3 }}>
      <span className="material-icons" style={{ fontSize:14 }}>cancel</span> Failed to save
    </span>
  );
  return null;
}

const SystemPreferences = () => {
  const navigate = useNavigate();

  const [category, setCategory] = useState([]);
  const [sizeList, setSizeList] = useState([]);
  const [setList,  setSetList]  = useState([]);

  const [sizeChartName, setSizeChartName] = useState("sizechart.png");
  const [sizeChartUrl,  setSizeChartUrl]  = useState(sizechart);
  const [showImage,     setShowImage]     = useState(false);

  const [isCategoryEditing, setIsCategoryEditing] = useState(false);
  const [isSetEditing,      setIsSetEditing]      = useState(false);
  const [isSizeEditing,     setIsSizeEditing]     = useState(false);

  const [newCategory, setNewCategory] = useState("");
  const [newSet,      setNewSet]      = useState("");
  const [newSize,     setNewSize]     = useState("");

  // ── Save badges ──
  const [categorySaveStatus, setCategorySaveStatus] = useState('');
  const [sizeSaveStatus,     setSizeSaveStatus]     = useState('');
  const [setSaveStatus,      setSetSaveStatus]      = useState('');

  // ── Overdue days ──
  const [overdueDays,       setOverdueDays]      = useState(7);
  const [overdueDaysInput,  setOverdueDaysInput] = useState(7);
  const [isOverdueEditing,  setIsOverdueEditing] = useState(false);
  const [overdueSaveStatus, setOverdueSaveStatus] = useState('');

  // ── Low stock ──
  const [lowStockQty,       setLowStockQty]      = useState(10);
  const [lowStockInput,     setLowStockInput]    = useState(10);
  const [isLowStockEditing, setIsLowStockEditing] = useState(false);
  const [lowStockStatus,    setLowStockStatus]   = useState('');

  // ── Alert / confirm modal ──
  const [alertModal,   setAlertModal]   = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({ type, title, message, btnLabel, onClose: onClose ?? (() => setAlertModal(null)) });
  };

  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({ title, message, onConfirm });
  };

  const flashStatus = (setter, value = 'saved') => {
    setter(value);
    setTimeout(() => setter(''), 2500);
  };

  // ─── Fetch all on mount ───────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [catRes, sizeRes, setRes, settingsRes, lowStockRes] = await Promise.all([
          fetch(CATEGORY_API), fetch(SIZE_API), fetch(SET_API), fetch(SETTINGS_API), fetch(LOWSTOCK_API),
        ]);
        const [catData, sizeData, setData, settingsData, lowStockData] = await Promise.all([
          catRes.json(), sizeRes.json(), setRes.json(), settingsRes.json(), lowStockRes.json(),
        ]);
        setCategory(catData);
        setSizeList(sizeData);
        setSetList(setData);
        if (settingsData?.overdueDays) { setOverdueDays(settingsData.overdueDays); setOverdueDaysInput(settingsData.overdueDays); }
        if (lowStockData?.lowStockQty) { setLowStockQty(lowStockData.lowStockQty); setLowStockInput(lowStockData.lowStockQty); }
      } catch (err) { console.error('Failed to fetch data:', err); }
    };
    fetchAll();
  }, []);

  // ─── Overdue ──────────────────────────────────────────────────────
  const handleSaveOverdueDays = async () => {
    const days = Number(overdueDaysInput);
    if (!days || days < 1) return showAlert('warning', 'Invalid Value', 'Please enter a valid number of days (minimum 1).');
    try {
      await fetch(SETTINGS_API, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ overdueDays: days }) });
      setOverdueDays(days);
      setIsOverdueEditing(false);
      flashStatus(setOverdueSaveStatus, 'saved');
    } catch (err) {
      flashStatus(setOverdueSaveStatus, 'error');
    }
  };

  // ─── Low stock ────────────────────────────────────────────────────
  const handleSaveLowStock = async () => {
    const qty = Number(lowStockInput);
    if (!qty || qty < 1) return showAlert('warning', 'Invalid Value', 'Please enter a valid quantity (minimum 1).');
    try {
      await fetch(LOWSTOCK_API, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ lowStockQty: qty }) });
      setLowStockQty(qty);
      setIsLowStockEditing(false);
      flashStatus(setLowStockStatus, 'saved');
    } catch (err) {
      flashStatus(setLowStockStatus, 'error');
    }
  };

  // ─── Size chart ───────────────────────────────────────────────────
  const handleSizeChartChange = (e) => {
    const file = e.target.files[0];
    if (file) { setSizeChartUrl(URL.createObjectURL(file)); setSizeChartName(file.name); setShowImage(false); }
  };

  // ─── Category CRUD ────────────────────────────────────────────────
  const handleCategoryNameChange = (id, value) =>
    setCategory(category.map(c => c._id === id ? { ...c, name: value } : c));

  const handleUpdateCategory = async (id, name) => {
    try {
      await fetch(`${CATEGORY_API}/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name }) });
    } catch (err) { console.error('Failed to update category:', err); }
  };

  const handleDeleteCategory = (id, name) => {
    showConfirm(
      'Delete Category?',
      `"${name}" will be permanently removed from the category list.`,
      async () => {
        setConfirmModal(null);
        try {
          await fetch(`${CATEGORY_API}/${id}`, { method:'DELETE' });
          setCategory(prev => prev.filter(item => item._id !== id));
          flashStatus(setCategorySaveStatus, 'saved');
        } catch (err) {
          flashStatus(setCategorySaveStatus, 'error');
        }
      }
    );
  };

  const handleSaveCategory = async () => {
    if (newCategory.trim() !== "") {
      try {
        const res  = await fetch(CATEGORY_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name: newCategory.trim() }) });
        const data = await res.json();
        setCategory(prev => [...prev, data]);
        setNewCategory("");
      } catch (err) { console.error('Failed to add category:', err); flashStatus(setCategorySaveStatus, 'error'); return; }
    }
    setIsCategoryEditing(false);
    flashStatus(setCategorySaveStatus, 'saved');
  };

  // ─── Size CRUD ────────────────────────────────────────────────────
  const handleSizeNameChange = (id, value) =>
    setSizeList(sizeList.map(s => s._id === id ? { ...s, name: value } : s));

  const handleUpdateSize = async (id, name) => {
    try {
      await fetch(`${SIZE_API}/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name }) });
    } catch (err) { console.error('Failed to update size:', err); }
  };

  const handleDeleteSize = (id, name) => {
    showConfirm(
      'Delete Size?',
      `"${name}" will be permanently removed from the size list.`,
      async () => {
        setConfirmModal(null);
        try {
          await fetch(`${SIZE_API}/${id}`, { method:'DELETE' });
          setSizeList(prev => prev.filter(item => item._id !== id));
          flashStatus(setSizeSaveStatus, 'saved');
        } catch (err) {
          flashStatus(setSizeSaveStatus, 'error');
        }
      }
    );
  };

  const handleSaveSize = async () => {
    if (newSize.trim() !== "") {
      try {
        const res = await fetch(SIZE_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name: newSize.trim() }) });
        if (!res.ok) { flashStatus(setSizeSaveStatus, 'error'); return; }
        const data = await res.json();
        setSizeList(prev => [...prev, data]);
        setNewSize("");
      } catch (err) { flashStatus(setSizeSaveStatus, 'error'); return; }
    }
    setIsSizeEditing(false);
    flashStatus(setSizeSaveStatus, 'saved');
  };

  // ─── Set CRUD ─────────────────────────────────────────────────────
  const handleSetNameChange = (id, value) =>
    setSetList(setList.map(s => s._id === id ? { ...s, name: value } : s));

  const handleUpdateSet = async (id, name) => {
    try {
      await fetch(`${SET_API}/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name }) });
    } catch (err) { console.error('Failed to update set:', err); }
  };

  const handleDeleteSet = (id, name) => {
    showConfirm(
      'Delete Set?',
      `"${name}" will be permanently removed from the set list.`,
      async () => {
        setConfirmModal(null);
        try {
          await fetch(`${SET_API}/${id}`, { method:'DELETE' });
          setSetList(prev => prev.filter(item => item._id !== id));
          flashStatus(setSetSaveStatus, 'saved');
        } catch (err) {
          flashStatus(setSetSaveStatus, 'error');
        }
      }
    );
  };

  const handleSaveSet = async () => {
    if (newSet.trim() !== "") {
      try {
        const res  = await fetch(SET_API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name: newSet.trim() }) });
        const data = await res.json();
        setSetList(prev => [...prev, data]);
        setNewSet("");
      } catch (err) { flashStatus(setSetSaveStatus, 'error'); return; }
    }
    setIsSetEditing(false);
    flashStatus(setSetSaveStatus, 'saved');
  };

  return (
    <div className='system-container'>
      {alertModal   && <AlertModal {...alertModal} />}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      <Sidebar />
      <div className='store-information'>
        <Topbar />

        <div className='system-content'>
          <div className='settings-sidebar'>
            <div className='settings-header'>
              <button>
                <img src={back} className='back' alt='back' onClick={() => navigate("/dashboard")} />
              </button>
              <p>Settings</p>
            </div>
            <div className='settings-nav'>
              <ul>
                <li onClick={() => navigate("/storeinformation")}>Store Information</li>
                <li onClick={() => navigate("/usermanagement")}>User Management</li>
                <li onClick={() => navigate("/logreports")}>Log Reports</li>
                <li className='info'>System Preferences</li>
                <li onClick={() => navigate("/backuprecovery")}>Backup & Recovery</li>
              </ul>
            </div>
          </div>

          <div className='systempreferences-container'>
            <div className='spreferences-header'>
              <h2>System Preferences</h2>
            </div>

            <div className='spreferences-main'>
              <div className='language-time-con'>
                <div className='language-con'>
                  <h4>Language:</h4>
                  <p>ENGLISH</p>
                </div>
                <div className='timezone'>
                  <h4>Timezone:</h4>
                  <p>ASIAN/Manila (GMT +8:00)</p>
                </div>
              </div>

              {/* ── Overdue Setting ── */}
              <div className='category-list'>
                <div className='category-header'>
                  <h3>Order Overdue Setting</h3>
                </div>
                <div className='category-top'>
                  <p>Mark reserved orders as overdue after how many days</p>
                  <button onClick={isOverdueEditing ? handleSaveOverdueDays : () => setIsOverdueEditing(true)}>
                    {isOverdueEditing ? 'Save' : <><img src={edit} alt='edit' />Edit</>}
                  </button>
                </div>
                <div className='category-items' style={{ padding:'12px 16px' }}>
                  {isOverdueEditing ? (
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="number" min={1} value={overdueDaysInput} onChange={(e) => setOverdueDaysInput(e.target.value)}
                        style={{ width:80, padding:'6px 10px', borderRadius:6, border:'1px solid #ddd', fontSize:14, fontFamily:'Inter, sans-serif' }} />
                      <span style={{ fontSize:13, color:'rgba(0,0,0,0.55)' }}>days</span>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:22, fontWeight:700, color:'#8B333D' }}>{overdueDays}</span>
                      <span style={{ fontSize:13, color:'rgba(0,0,0,0.55)' }}>days after reservation</span>
                      <SaveBadge status={overdueSaveStatus} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Low Stock Setting ── */}
              <div className='category-list'>
                <div className='category-header'>
                  <h3>Low Stock Setting</h3>
                </div>
                <div className='category-top'>
                  <p>Mark products as low stock when quantity falls below</p>
                  <button onClick={isLowStockEditing ? handleSaveLowStock : () => setIsLowStockEditing(true)}>
                    {isLowStockEditing ? 'Save' : <><img src={edit} alt='edit' />Edit</>}
                  </button>
                </div>
                <div className='category-items' style={{ padding:'12px 16px' }}>
                  {isLowStockEditing ? (
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="number" min={1} value={lowStockInput} onChange={(e) => setLowStockInput(e.target.value)}
                        style={{ width:80, padding:'6px 10px', borderRadius:6, border:'1px solid #ddd', fontSize:14, fontFamily:'Inter, sans-serif' }} />
                      <span style={{ fontSize:13, color:'rgba(0,0,0,0.55)' }}>items</span>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:22, fontWeight:700, color:'#8B333D' }}>{lowStockQty}</span>
                      <span style={{ fontSize:13, color:'rgba(0,0,0,0.55)' }}>items remaining</span>
                      <SaveBadge status={lowStockStatus} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Category List ── */}
              <div className='category-list'>
                <div className='category-header'>
                  <h3>Category List</h3>
                </div>
                <div className='category-top'>
                  <p>Default Category</p>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <SaveBadge status={categorySaveStatus} />
                    <button onClick={isCategoryEditing ? handleSaveCategory : () => setIsCategoryEditing(true)}>
                      {isCategoryEditing ? 'Save' : <><img src={edit} alt='edit' />Edit</>}
                    </button>
                  </div>
                </div>
                <div className='category-items'>
                  <ul>
                    {category.map((item) => (
                      <li key={item._id}>
                        {isCategoryEditing ? (
                          <div className='edit-actions'>
                            <input
                              value={item.name}
                              onChange={(e) => handleCategoryNameChange(item._id, e.target.value)}
                              onBlur={() => handleUpdateCategory(item._id, item.name)}
                            />
                            <button className='delete-btn' onClick={() => handleDeleteCategory(item._id, item.name)}>✕</button>
                          </div>
                        ) : item.name}
                      </li>
                    ))}
                    {isCategoryEditing && (
                      <div className='add-category'>
                        <input type="text" placeholder="Add new category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                      </div>
                    )}
                  </ul>
                </div>
              </div>

              {/* ── Size List ── */}
              <div className='size-list'>
                <div className='size-header'>
                  <h3>Size List</h3>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <SaveBadge status={sizeSaveStatus} />
                    <button onMouseDown={(e) => e.preventDefault()} onClick={isSizeEditing ? handleSaveSize : () => setIsSizeEditing(true)}>
                      {isSizeEditing ? 'Save' : <><img src={edit} alt='edit' />Edit</>}
                    </button>
                  </div>
                </div>
                <div className='size-top'>
                  <h5>Size Chart:</h5>
                  <div className="size-chart-edit">
                    {showImage ? (
                      <img src={sizeChartUrl} alt="Size Chart" className="size-chart-preview" onClick={() => setShowImage(false)} />
                    ) : (
                      <span onClick={() => setShowImage(true)}>{sizeChartName}</span>
                    )}
                    {isSizeEditing && (
                      <>
                        <button onClick={() => document.getElementById("fileInput").click()}>Change</button>
                        <input id="fileInput" type="file" style={{ display:"none" }} onChange={handleSizeChartChange} />
                      </>
                    )}
                  </div>
                </div>
                <div className='default-size'>
                  <div className='default-head'><p>Default Size</p></div>
                  <div className='default-items'>
                    <ul>
                      {sizeList.map((item) => (
                        <li key={item._id}>
                          {isSizeEditing ? (
                            <div className='edit-actions'>
                              <input
                                value={item.name}
                                onChange={(e) => handleSizeNameChange(item._id, e.target.value)}
                                onBlur={() => handleUpdateSize(item._id, item.name)}
                              />
                              <button className='delete-btn' onMouseDown={(e) => e.preventDefault()} onClick={() => handleDeleteSize(item._id, item.name)}>✕</button>
                            </div>
                          ) : item.name}
                        </li>
                      ))}
                      {isSizeEditing && (
                        <div className='add-size'>
                          <input type="text" placeholder="Add size" value={newSize} onChange={(e) => setNewSize(e.target.value)} />
                        </div>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* ── Set List ── */}
              <div className='set-list'>
                <div className='set-header'>
                  <h3>Set</h3>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <SaveBadge status={setSaveStatus} />
                    <button onClick={isSetEditing ? handleSaveSet : () => setIsSetEditing(true)}>
                      {isSetEditing ? 'Save' : <><img src={edit} alt='edit' />Edit</>}
                    </button>
                  </div>
                </div>
                <div className='set-con'>
                  <div className='set-head'><p>Default Set</p></div>
                  <div className='set-items'>
                    <ul>
                      {setList.map((item) => (
                        <li key={item._id}>
                          {isSetEditing ? (
                            <div className='edit-actions'>
                              <input
                                value={item.name}
                                onChange={(e) => handleSetNameChange(item._id, e.target.value)}
                                onBlur={() => handleUpdateSet(item._id, item.name)}
                              />
                              <button className='delete-btn' onClick={() => handleDeleteSet(item._id, item.name)}>✕</button>
                            </div>
                          ) : item.name}
                        </li>
                      ))}
                      {isSetEditing && (
                        <li className='add-category'>
                          <input type="text" placeholder="Add Set" value={newSet} onChange={(e) => setNewSet(e.target.value)} />
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPreferences;