import React, { useState, useRef } from 'react';
import './Login.css';
import logo from '../../Assets/logo.png';
import LOGIN from '../../Assets/LOGIN.png';
import visibility from '../../Assets/visibility.png';
import { useNavigate } from 'react-router-dom';

const ALERT_META = {
  success: {
    icon: 'check',
    iconColor: '#3DB82B',
    circleBg: 'rgba(112,233,90,0.15)',
    circleBorder: 'rgba(112,233,90,0.45)',
    btnBg: '#3DB82B',
  },
  error: {
    icon: 'close',
    iconColor: '#c0392b',
    circleBg: 'rgba(192,57,43,0.10)',
    circleBorder: 'rgba(192,57,43,0.35)',
    btnBg: '#c0392b',
  },
  warning: {
    icon: 'warning',
    iconColor: '#e67e22',
    circleBg: 'rgba(230,126,34,0.10)',
    circleBorder: 'rgba(230,126,34,0.35)',
    btnBg: '#e67e22',
  },
};

function AlertModal({ type, title, message, btnLabel = 'OK', onClose, disabled }) {
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
          <button
            className="pmodal__submit-btn"
            style={{ background: disabled ? 'rgba(0,0,0,0.2)' : meta.btnBg, cursor: disabled ? 'not-allowed' : 'pointer' }}
            onClick={onClose}
            disabled={disabled}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const Login = () => {
  const navigate = useNavigate();

  const emailRef    = useRef(null);
  const passwordRef = useRef(null);
  const countdownRef = useRef(null); // ✅ track countdown interval

  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [alertModal, setAlertModal] = useState(null);

  const showAlert = (type, title, message, btnLabel = 'OK', onClose = null, disabled = false) => {
    setAlertModal({
      type, title, message, btnLabel, disabled,
      onClose: onClose ?? (() => setAlertModal(null)),
    });
  };

  // ✅ show countdown alert when blocked
  const showCountdown = (secondsLeft) => {
    let remaining = secondsLeft;

    // clear any existing countdown
    if (countdownRef.current) clearInterval(countdownRef.current);

    showAlert(
      'warning',
      'Account Temporarily Locked',
      `Too many failed attempts. Please wait ${remaining} second(s) before trying again.`,
      `Wait ${remaining}s`,
      null,
      true // disable OK button during countdown
    );

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setAlertModal(null); // ✅ auto close when countdown ends
      } else {
        setAlertModal(prev => ({
          ...prev,
          message:  `Too many failed attempts. Please wait ${remaining} second(s) before trying again.`,
          btnLabel: `Wait ${remaining}s`,
        }));
      }
    }, 1000);
  };

  const handleLogin = async () => {
    const email    = emailRef.current?.value?.trim();
    const password = passwordRef.current?.value;

    if (!email || !password) {
      showAlert('warning', 'Missing Fields', 'Please enter your email and password before continuing.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          // ✅ show countdown timer
          showCountdown(data.secondsLeft || 60);
        } else if (res.status === 401) {
          showAlert('error', 'Incorrect Credentials', data.message || 'Your email or password is incorrect. Please try again.', 'Try Again');
        } else if (res.status === 403) {
          showAlert('error', 'Access Denied', data.message || 'Your account does not have admin access.');
        } else if (res.status === 404) {
          showAlert('error', 'Account Not Found', data.message || 'No account found with that email address.');
        } else {
          // ✅ show attempts remaining message from backend
          showAlert('error', 'Login Failed', data.message || 'Something went wrong. Please try again.', 'Try Again');
        }
      } else {
        localStorage.setItem('user',  JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        showAlert(
          'success',
          'Login Successful!',
          'Welcome back, Admin. You are now being redirected to the dashboard.',
          'Done',
          () => {
            setAlertModal(null);
            navigate('/dashboard');
          }
        );
      }
    } catch (err) {
      showAlert('error', 'Connection Error', 'Unable to reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <>
      {alertModal && (
        <AlertModal
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          btnLabel={alertModal.btnLabel}
          disabled={alertModal.disabled}
          onClose={alertModal.onClose}
        />
      )}

      <div className="login-main" style={{ backgroundImage: `url(${LOGIN})` }}>
        <div className="login-container">
          <div className="login-header">
            <img src={logo} className="logo" alt="Logo" />
            <h2>Log in to your Account</h2>
            <p>Welcome back Admin! Enter your details to log in to your account</p>

            <div className="login-form">
              <input
                ref={emailRef}
                type="text"
                placeholder="Enter Email"
                className="input-user"
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <div className="password-wrapper">
                <div className="forgot">
                  <p onClick={() => navigate('/Forgot')}>Forgot Password?</p>
                </div>
                <div className="password-container">
                  <input
                    ref={passwordRef}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Enter Password"
                    className="input-password"
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                  />
                  <img
                    src={visibility}
                    alt="Toggle visibility"
                    style={{ cursor:'pointer', opacity: showPass ? 1 : 0.5 }}
                    onClick={() => setShowPass(v => !v)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit"
              onClick={handleLogin}
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Logging in…' : 'Login to your Account'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;