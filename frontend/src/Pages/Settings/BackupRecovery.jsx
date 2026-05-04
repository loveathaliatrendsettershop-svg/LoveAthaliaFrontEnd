import Topbar from '../../Components/notif/Topbar'
import Sidebar from '../../Components/sidebar/Sidebar'
import React, { useState, useRef } from "react"
import back from '../../Assets/back.png'
import './SystemPreferences.css'
import { useNavigate } from "react-router-dom";

const BACKUP_API = `${import.meta.env.VITE_API_URL}/api/db`;

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
        <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(230,126,34,0.10)', border:'2px solid rgba(230,126,34,0.35)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
          <span className="material-icons" style={{ fontSize:36, color:'#e67e22' }}>warning</span>
        </div>
        <h2 className="pmodal__delete-title">{title}</h2>
        <p className="pmodal__delete-msg">{message}</p>
        <div className="pmodal__delete-actions">
          <button className="pmodal__discard-btn" onClick={onCancel}>Cancel</button>
          <button className="pmodal__submit-btn" style={{ background:'#c0392b' }} onClick={onConfirm}>Yes, Restore</button>
        </div>
      </div>
    </div>
  );
}

const BackupRecovery = () => {
  const navigate = useNavigate();

  const [dragging,     setDragging]     = useState(false);
  const [file,         setFile]         = useState(null);
  const [restoring,    setRestoring]    = useState(false);
  const [downloading,  setDownloading]  = useState(false);
  const [alertModal,   setAlertModal]   = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const inputRef = useRef(null);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({ type, title, message, btnLabel, onClose: onClose ?? (() => setAlertModal(null)) });
  };

  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.json')) {
      setFile(dropped);
    } else {
      showAlert('error', 'Invalid File', 'Please upload a valid .json backup file.');
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res  = await fetch(`${BACKUP_API}/backup`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `backup_${new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAlert('success', 'Backup Downloaded!', 'Your backup has been saved to your Downloads folder.');
    } catch (err) {
      showAlert('error', 'Download Failed', 'Could not download the backup. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestoreConfirmed = async () => {
    setConfirmModal(null);
    setRestoring(true);
    try {
      const form = new FormData();
      form.append('backup', file);
      const res  = await fetch(`${BACKUP_API}/restore`, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        setFile(null);
        showAlert('success', 'Database Restored!', 'Your database has been restored successfully from the backup file.');
      } else {
        showAlert('error', 'Restore Failed', data.message || 'Could not restore the database. Please try again.');
      }
    } catch {
      showAlert('error', 'Connection Error', 'Something went wrong. Please check your connection and try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRestore = () => {
    if (!file) return;
    setConfirmModal(true);
  };

  return (
    <div className='system-container'>
      {alertModal && <AlertModal {...alertModal} />}
      {confirmModal && (
        <ConfirmModal
          title="Restore Database?"
          message="This will overwrite ALL current data with the backup file. This action cannot be undone. Are you sure you want to continue?"
          onConfirm={handleRestoreConfirmed}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      <Sidebar />
      <div className='store-information'>
        <Topbar />
        <div className='system-content'>

          {/* ── Left Settings Sidebar ── */}
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
                <li onClick={() => navigate("/systempreferences")}>System Preferences</li>
                <li className='info'>Backup & Recovery</li>
              </ul>
            </div>
          </div>

          {/* ── Main Content ── */}
          <div className='systempreferences-container'>
            <div className='spreferences-header'>
              <h2>Backup & Recovery</h2>
            </div>

            <div className='spreferences-main'>
              <div className='category-list'>
                <div className='category-header'>
                  <h3>Backup & Recovery</h3>
                </div>

                <div style={{ padding:'14px 16px' }}>
                  <p style={{ fontSize:13, color:'rgba(0,0,0,0.5)', marginBottom:16, lineHeight:1.6 }}>
                    Download a full backup of the database or restore from a previous backup file.
                    Save backups somewhere safe like a USB drive or Google Drive.
                  </p>

                  <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'stretch' }}>

                    {/* ── Download Card ── */}
                    <div style={{ flex:1, minWidth:200, border:'1px solid rgba(0,0,0,0.09)', borderRadius:10, padding:'18px 20px', background:'rgba(139,51,61,0.03)', display:'flex', flexDirection:'column', gap:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span className="material-icons" style={{ color:'#8B333D', fontSize:22 }}>download</span>
                        <span style={{ fontWeight:700, fontSize:14 }}>Download Backup</span>
                      </div>
                      <p style={{ fontSize:12, color:'rgba(0,0,0,0.45)', lineHeight:1.6, flex:1 }}>
                        Export a complete snapshot of the database as a <strong>.json</strong> file.
                        Each download is timestamped so backups never overwrite each other.
                      </p>
                      <button
                        onClick={handleDownload}
                        disabled={downloading}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', background:downloading ? 'rgba(0,0,0,0.08)' : '#8B333D', color:downloading ? 'rgba(0,0,0,0.3)' : '#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'Inter, sans-serif', cursor:downloading ? 'not-allowed' : 'pointer', width:'fit-content', marginTop:'auto', transition:'all 0.2s' }}
                      >
                        <span className="material-icons" style={{ fontSize:16 }}>
                          {downloading ? 'hourglass_empty' : 'download'}
                        </span>
                        {downloading ? 'Downloading...' : 'Download Backup'}
                      </button>
                    </div>

                    {/* ── Restore Card ── */}
                    <div style={{ flex:1, minWidth:220, border:'1px solid rgba(0,0,0,0.09)', borderRadius:10, padding:'18px 20px', background:'rgba(21,0,160,0.02)', display:'flex', flexDirection:'column', gap:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span className="material-icons" style={{ color:'#1500A0', fontSize:22 }}>restore</span>
                        <span style={{ fontWeight:700, fontSize:14 }}>Restore from Backup</span>
                      </div>
                      <p style={{ fontSize:12, color:'rgba(0,0,0,0.45)', lineHeight:1.6 }}>
                        Upload a <strong>.json</strong> backup file.{' '}
                        <strong style={{ color:'#990214' }}>This will overwrite all current data.</strong>
                      </p>

                      {/* Drag & Drop Zone */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        style={{ border:`2px dashed ${dragging ? '#1500A0' : file ? '#419E0B' : 'rgba(0,0,0,0.18)'}`, borderRadius:8, padding:'22px 16px', textAlign:'center', cursor:'pointer', background:dragging ? 'rgba(21,0,160,0.05)' : file ? 'rgba(65,158,11,0.05)' : 'rgba(0,0,0,0.015)', transition:'all 0.2s' }}
                      >
                        <span className="material-icons" style={{ fontSize:32, color:dragging ? '#1500A0' : file ? '#419E0B' : 'rgba(0,0,0,0.25)', display:'block', marginBottom:6 }}>
                          {file ? 'check_circle' : 'upload_file'}
                        </span>
                        {file ? (
                          <p style={{ fontSize:12, color:'#419E0B', fontWeight:600 }}>{file.name}</p>
                        ) : (
                          <>
                            <p style={{ fontSize:12, color:'rgba(0,0,0,0.45)', marginBottom:4 }}>Drag & drop your backup file here</p>
                            <p style={{ fontSize:11, color:'rgba(0,0,0,0.3)' }}>or click to select a <strong>.json</strong> file</p>
                          </>
                        )}
                      </div>

                      <input ref={inputRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleFileSelect} />

                      {/* Actions */}
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        {file && (
                          <button
                            onClick={() => setFile(null)}
                            style={{ padding:'7px 14px', background:'transparent', border:'1px solid rgba(0,0,0,0.15)', borderRadius:7, fontSize:12, cursor:'pointer', fontFamily:'Inter, sans-serif', color:'rgba(0,0,0,0.5)' }}
                          >
                            Clear
                          </button>
                        )}
                        <button
                          onClick={handleRestore}
                          disabled={!file || restoring}
                          style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background:!file || restoring ? 'rgba(0,0,0,0.08)' : '#1500A0', color:!file || restoring ? 'rgba(0,0,0,0.3)' : '#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'Inter, sans-serif', cursor:!file || restoring ? 'not-allowed' : 'pointer', transition:'all 0.2s' }}
                        >
                          <span className="material-icons" style={{ fontSize:15 }}>
                            {restoring ? 'hourglass_empty' : 'restore'}
                          </span>
                          {restoring ? 'Restoring...' : 'Restore Database'}
                        </button>
                      </div>
                    </div>

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

export default BackupRecovery;
