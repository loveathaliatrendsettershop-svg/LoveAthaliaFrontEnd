import Topbar from '../../Components/notif/Topbar'
import Sidebar from '../../Components/sidebar/Sidebar'
import React, { useState, useEffect } from "react"
import back from '../../Assets/back.png'
import './usermanagement.css'
import { useNavigate } from "react-router-dom";

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
          <button className="pmodal__submit-btn" style={{ background:'#c0392b' }} onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}

const Usermanagement = () => {
  const navigate = useNavigate();

  const getUserFromStorage = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw || raw === 'undefined') return {};
      return JSON.parse(raw);
    } catch { return {}; }
  };

  const storedUser = getUserFromStorage();

  const [userImage,        setUserImage]        = useState(storedUser.image || null);
  const [firstName,        setFirstName]        = useState(storedUser.first_name || '');
  const [lastName,         setLastName]         = useState(storedUser.last_name || '');
  const [email,            setEmail]            = useState(storedUser.email || '');
  const [role,             setRole]             = useState(storedUser.role || '');
  const [isEditing,        setIsEditing]        = useState(false);
  const [isSaving,         setIsSaving]         = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Password modal state
  const [showPasswordModal,  setShowPasswordModal]  = useState(false);
  const [currentPassword,    setCurrentPassword]    = useState('');
  const [newPassword,        setNewPassword]        = useState('');
  const [confirmPassword,    setConfirmPassword]    = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Alert / confirm modal state
  const [alertModal,   setAlertModal]   = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({ type, title, message, btnLabel, onClose: onClose ?? (() => setAlertModal(null)) });
  };

  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({ title, message, onConfirm });
  };

  useEffect(() => {
    const fetchUser = async () => {
      if (!storedUser._id) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${storedUser._id}`);
        if (!res.ok) return;
        const data = await res.json();
        setFirstName(data.first_name || '');
        setLastName(data.last_name  || '');
        setEmail(data.email         || '');
        setRole(data.role           || '');
        setUserImage(data.image     || null);
        localStorage.setItem('user', JSON.stringify({ ...storedUser, ...data }));
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    };
    fetchUser();
  }, []);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('images', file);
      const uploadRes = await fetch(`${import.meta.env.VITE_API_URL}/api/upload`, { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const imageUrl   = uploadData.urls[0];
      const updateRes = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${storedUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageUrl }),
      });
      if (!updateRes.ok) throw new Error('Failed to save image');
      const updatedUser = await updateRes.json();
      setUserImage(updatedUser.image);
      localStorage.setItem('user', JSON.stringify({ ...storedUser, image: updatedUser.image }));
      showAlert('success', 'Image Updated!', 'Your profile image has been updated successfully.');
    } catch (err) {
      showAlert('error', 'Upload Failed', err.message || 'Could not upload your image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    showConfirm(
      'Remove Profile Image?',
      'Your profile image will be removed. You can upload a new one anytime.',
      async () => {
        setConfirmModal(null);
        try {
          await fetch(`${import.meta.env.VITE_API_URL}/api/users/${storedUser._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: '' }),
          });
          setUserImage(null);
          localStorage.setItem('user', JSON.stringify({ ...storedUser, image: '' }));
          showAlert('success', 'Image Removed', 'Your profile image has been removed.');
        } catch (err) {
          showAlert('error', 'Remove Failed', 'Could not remove your image. Please try again.');
        }
      }
    );
  };

  const handleSaveInfo = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      return showAlert('warning', 'Missing Fields', 'First name and last name cannot be empty.');
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${storedUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const updatedUser = await res.json();
      localStorage.setItem('user', JSON.stringify({ ...storedUser, first_name: updatedUser.first_name, last_name: updatedUser.last_name }));
      setIsEditing(false);
      showAlert('success', 'Profile Updated!', 'Your profile information has been saved successfully.');
    } catch (err) {
      showAlert('error', 'Update Failed', err.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Change password — all validation via AlertModal ─────────────────────
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return showAlert('warning', 'Missing Fields', 'All password fields are required.');
    }
    if (newPassword.length < 8) {
      return showAlert('warning', 'Password Too Short', 'Your new password must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(newPassword)) {
      return showAlert('warning', 'Uppercase Required', 'Your new password must contain at least one uppercase letter.');
    }
    if (!/[0-9]/.test(newPassword)) {
      return showAlert('warning', 'Number Required', 'Your new password must contain at least one number.');
    }
    if (newPassword !== confirmPassword) {
      return showAlert('error', 'Passwords Do Not Match', 'The new passwords you entered do not match. Please try again.');
    }

    setIsChangingPassword(true);
    try {
      const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: currentPassword }),
      });
      if (!verifyRes.ok) {
        setIsChangingPassword(false);
        return showAlert('error', 'Incorrect Password', 'Your current password is incorrect. Please try again.');
      }

      const updateRes = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${storedUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!updateRes.ok) throw new Error('Failed to update password.');

      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showAlert('success', 'Password Changed!', 'Your password has been updated successfully.');
    } catch (err) {
      showAlert('error', 'Update Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancelEdit = () => {
    const stored = getUserFromStorage();
    setFirstName(stored.first_name || '');
    setLastName(stored.last_name   || '');
    setIsEditing(false);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className='umaccount-container'>
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

        <div className='umaccount-content'>
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
                <li className='info' onClick={() => navigate("/userManagement")}>User Management</li>
                <li onClick={() => navigate("/logreports")}>Log Reports</li>
                <li onClick={() => navigate("/systempreferences")}>System Preferences</li>
                <li onClick={() => navigate("/backuprecovery")}>Backup & Recovery</li>
              </ul>
            </div>
          </div>

          <div className='umaccount'>
            <div className='umaccount-header'>
              <div className='account-settings'>
                <p>Account Settings</p>
              </div>
            </div>

            <div className='umaccount-main'>
              <div className='user-info'>
                <div className='user-image'>
                  {isUploadingImage ? (
                    <div className='no-image'>Uploading...</div>
                  ) : userImage ? (
                    <img src={userImage} alt="User" />
                  ) : (
                    <div className='no-image'>No Image</div>
                  )}
                </div>

                <div className='info-container'>
                  <div className='info-button'>
                    <button className='change' onClick={() => document.getElementById('imageUpload').click()} disabled={isUploadingImage}>
                      {isUploadingImage ? 'Uploading...' : 'Change Image'}
                    </button>
                    <button className='remove' onClick={handleRemoveImage} disabled={isUploadingImage || !userImage}>
                      Remove Image
                    </button>
                  </div>

                  <div className='info-name'>
                    <div className='first'>
                      <h4>First Name</h4>
                      {isEditing ? (
                        <input type='text' value={firstName} onChange={(e) => setFirstName(e.target.value)} className='edit-input' />
                      ) : (
                        <p>{firstName || '—'}</p>
                      )}
                    </div>
                    <div className='last'>
                      <h4>Last Name</h4>
                      {isEditing ? (
                        <input type='text' value={lastName} onChange={(e) => setLastName(e.target.value)} className='edit-input' />
                      ) : (
                        <p>{lastName || '—'}</p>
                      )}
                    </div>
                  </div>

                  <div className='info-role'>
                    <h4>Role</h4>
                    <p className={`role-badge ${role}`}>{role || '—'}</p>
                  </div>

                  <div className='edit-actions'>
                    {isEditing ? (
                      <>
                        <button className='change' onClick={handleSaveInfo} disabled={isSaving}>
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button className='remove' onClick={handleCancelEdit}>Cancel</button>
                      </>
                    ) : (
                      <button className='change' onClick={() => setIsEditing(true)}>Edit Profile</button>
                    )}
                  </div>
                </div>
              </div>

              <div className='account-security'>
                <div className='as-header'>
                  <p>Account Security</p>
                </div>
                <div className='as-content'>
                  <div className='as-email'>
                    <p>Email:</p>
                    <div className='change-email'>
                      <p>{email || '—'}</p>
                    </div>
                  </div>
                  <div className='as-password'>
                    <p>Password:</p>
                    <div className='change-password'>
                      <p>••••••••</p>
                      <button onClick={() => setShowPasswordModal(true)}>Change Password</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <input type="file" accept="image/*" id="imageUpload" style={{ display:'none' }} onChange={handleImageChange} />

      {/* Password Modal */}
      {showPasswordModal && (
        <div className='modal-overlay' onClick={closePasswordModal}>
          <div className='modal-box' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <h3>Change Password</h3>
              <button className='modal-close' onClick={closePasswordModal}>✕</button>
            </div>
            <div className='modal-body'>
              <div className='modal-field'>
                <label>Current Password</label>
                <input type='password' value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder='Enter current password' />
              </div>
              <div className='modal-field'>
                <label>New Password</label>
                <input type='password' value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder='Enter new password' />
              </div>
              <div className='modal-field'>
                <label>Confirm New Password</label>
                <input type='password' value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder='Confirm new password' />
              </div>
            </div>
            <div className='modal-footer'>
              <button className='remove' onClick={closePasswordModal}>Cancel</button>
              <button className='change' onClick={handleChangePassword} disabled={isChangingPassword}>
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usermanagement;