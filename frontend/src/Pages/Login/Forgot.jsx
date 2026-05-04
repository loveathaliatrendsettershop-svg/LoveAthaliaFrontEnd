import React, { useState } from 'react';
import './Forgot.css'
import logo from '../../Assets/logo.png'
import LOGIN from '../../Assets/LOGIN.png'
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

const Forgot = () => {
  const navigate = useNavigate();
  const [email,      setEmail]      = useState('');
  const [alertModal, setAlertModal] = useState(null);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({ type, title, message, btnLabel, onClose: onClose ?? (() => setAlertModal(null)) });
  };

  const handleSendPin = async () => {
    if (!email) {
      return showAlert('warning', 'Missing Email', 'Please enter your email address before continuing.');
    }

    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/forgot/send-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          showAlert('error', 'Email Not Found', data.message || 'No account is associated with that email address.');
        } else {
          showAlert('error', 'Request Failed', data.message || 'Could not send the PIN. Please try again.');
        }
      } else {
        showAlert('success', 'PIN Sent!', `A confirmation code has been sent to ${email}. Please check your inbox.`, 'Continue', () => {
          setAlertModal(null);
          navigate("/Verify", { state: { email } });
        });
      }
    } catch (err) {
      showAlert('error', 'Connection Error', 'Unable to reach the server. Please check your connection and try again.');
    }
  };

  return (
    <>
      {alertModal && <AlertModal {...alertModal} />}
      <div className='forgot-main' style={{ backgroundImage:`url(${LOGIN})` }}>
        <div className='forgot-container'>
          <div className='forgot-header'>
            <img src={logo} />
            <h2>FORGOT PASSWORD</h2>
            <p>Please write your email to receive confirmation code</p>
          </div>
          <div className='forgot-form'>
            <input type='text' className='forgot-email' placeholder='Enter Email'
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendPin()} />
          </div>
          <button type='button' className='forgot-submit' onClick={handleSendPin}>Confirm Email</button>
        </div>
      </div>
    </>
  );
};

export default Forgot;