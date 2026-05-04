import React, { useState } from 'react'
import './Confirm.css'
import logo from '../../Assets/logo.png'
import LOGIN from '../../Assets/LOGIN.png'
import visibility from '../../Assets/visibility.png'
import { useNavigate, useLocation } from "react-router-dom"; 

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

const Confirm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const pin   = location.state?.pin;

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [alertModal,      setAlertModal]      = useState(null);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({ type, title, message, btnLabel, onClose: onClose ?? (() => setAlertModal(null)) });
  };

  const handleReset = async () => {
    if (!newPassword) {
      return showAlert('warning', 'Missing Password', 'Please enter a new password.');
    }
    if (newPassword.length < 8) {
      return showAlert('warning', 'Password Too Short', 'Your password must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(newPassword)) {
      return showAlert('warning', 'Uppercase Required', 'Your password must contain at least one uppercase letter.');
    }
    if (!/[0-9]/.test(newPassword)) {
      return showAlert('warning', 'Number Required', 'Your password must contain at least one number.');
    }
    if (newPassword !== confirmPassword) {
      return showAlert('error', 'Passwords Do Not Match', 'The passwords you entered do not match. Please try again.');
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/forgot/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert('error', 'Reset Failed', data.message || 'Could not reset your password. Please try again.');
      } else {
        navigate("/Change");
      }
    } catch (err) {
      showAlert('error', 'Connection Error', 'Unable to reach the server. Please check your connection and try again.');
    }
  };

  return (
    <>
      {alertModal && <AlertModal {...alertModal} />}
      <div className='Confirm-main' style={{ backgroundImage:`url(${LOGIN})` }}>
        <div className='confirm-container'>
          <div className='confirm-header'>
            <img src={logo} />
            <h2>New Password</h2>
            <p>Please set your new password</p>
          </div>
          <div className='confirm-form'>
            <div className='password-form'>
              <input
                type={showNew ? 'text' : 'password'}
                className='confirm-password'
                placeholder='Enter New Password'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button type='button' className='visible-button' onClick={() => setShowNew(!showNew)}>
                <img src={visibility} />
              </button>
            </div>
            <div className='password-form'>
              <input
                type={showConfirm ? 'text' : 'password'}
                className='confirm-password'
                placeholder='Confirm New Password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type='button' className='visible-button' onClick={() => setShowConfirm(!showConfirm)}>
                <img src={visibility} />
              </button>
            </div>
          </div>
          <button type='button' className='confirm-submit' onClick={handleReset}>
            Reset Password
          </button>
        </div>
      </div>
    </>
  );
};

export default Confirm;