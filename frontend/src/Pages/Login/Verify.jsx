import React, { useState, useRef, useEffect } from 'react'
import './Verify.css'
import logo from '../../Assets/logo.png'
import LOGIN from '../../Assets/LOGIN.png'
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

const Verify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [pins,       setPins]       = useState(['', '', '', '']);
  const [timer,      setTimer]      = useState(30);
  const [canResend,  setCanResend]  = useState(false);
  const [alertModal, setAlertModal] = useState(null);
  const inputs = useRef([]);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null) => {
    setAlertModal({ type, title, message, btnLabel, onClose: onClose ?? (() => setAlertModal(null)) });
  };

  useEffect(() => {
    if (timer === 0) { setCanResend(true); return; }
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = async () => {
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/forgot/send-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert('error', 'Resend Failed', data.message || 'Could not resend the code. Please try again.');
      } else {
        setTimer(30);
        setCanResend(false);
        setPins(['', '', '', '']);
        inputs.current[0]?.focus();
        showAlert('success', 'Code Resent!', `A new verification code has been sent to ${email}.`);
      }
    } catch (err) {
      showAlert('error', 'Connection Error', 'Unable to reach the server. Please check your connection and try again.');
    }
  };

  const handleChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;
    const newPins = [...pins];
    newPins[index] = value;
    setPins(newPins);
    if (value && index < 3) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !pins[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const pin = pins.join('');
    if (pin.length < 4) {
      return showAlert('warning', 'Incomplete PIN', 'Please enter the full 4-digit verification code.');
    }

    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/forgot/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400) {
          showAlert('error', 'Invalid Code', data.message || 'The code you entered is incorrect. Please try again.');
        } else if (res.status === 410) {
          showAlert('error', 'Code Expired', 'Your verification code has expired. Please request a new one.');
        } else {
          showAlert('error', 'Verification Failed', data.message || 'Could not verify the code. Please try again.');
        }
        setPins(['', '', '', '']);
        inputs.current[0]?.focus();
      } else {
        navigate("/Confirm", { state: { email, pin } });
      }
    } catch (err) {
      showAlert('error', 'Connection Error', 'Unable to reach the server. Please check your connection and try again.');
    }
  };

  return (
    <>
      {alertModal && <AlertModal {...alertModal} />}
      <div className='verify-main' style={{ backgroundImage:`url(${LOGIN})` }}>
        <div className='verify-container'>
          <div className='verify-header'>
            <img src={logo} />
            <h2>Forgot Password</h2>
            <h3>Verify Email Address</h3>
            <p>Verification Code Sent to {email}</p>
          </div>

          <div className='code-form'>
            {pins.map((p, i) => (
              <input
                key={i}
                type='text'
                className='input-code'
                maxLength={1}
                value={p}
                ref={(el) => (inputs.current[i] = el)}
                onChange={(e) => handleChange(e.target.value, i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
              />
            ))}
          </div>

          <button type='button' className='verify-submit' onClick={handleVerify}>Confirm Email</button>

          {canResend ? (
            <p onClick={handleResend} style={{ cursor:'pointer', color:'blue' }}>Resend Code</p>
          ) : (
            <p>Resend Code in 0:{timer < 10 ? `0${timer}` : timer}</p>
          )}
        </div>
      </div>
    </>
  );
};

export default Verify;