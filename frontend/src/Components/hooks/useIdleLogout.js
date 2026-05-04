import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const IDLE_TIMEOUT     = 60 * 60 * 1000; // 1 hour
const WARNING_DURATION = 60;              // 60 seconds to respond

export default function useIdleLogout() {
  const navigate        = useNavigate();
  const timerRef        = useRef(null);
  const warningRef      = useRef(null);
  const countdownRef    = useRef(null);
  const showWarningRef  = useRef(false); // ✅ use ref instead of state for the check
  const [showWarning,   setShowWarning]  = useState(false);
  const [secondsLeft,   setSecondsLeft]  = useState(WARNING_DURATION);

  const logout = useCallback(async () => {
    clearInterval(countdownRef.current);
    clearTimeout(warningRef.current);
    showWarningRef.current = false;
    setShowWarning(false);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user?.email) {
        await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: user.email }),
        });
      }
    } catch (err) {
      console.error('Auto-logout error:', err);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
    }
  }, [navigate]);

  const showWarningModal = useCallback(() => {
    showWarningRef.current = true; // ✅ set ref
    setShowWarning(true);
    setSecondsLeft(WARNING_DURATION);

    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    clearTimeout(warningRef.current);
    warningRef.current = setTimeout(logout, WARNING_DURATION * 1000); // ✅ logout after countdown
  }, [logout]);

  const stayLoggedIn = useCallback(() => {
    clearTimeout(warningRef.current);
    clearInterval(countdownRef.current);
    showWarningRef.current = false; // ✅ reset ref
    setShowWarning(false);
    setSecondsLeft(WARNING_DURATION);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(showWarningModal, IDLE_TIMEOUT);
  }, [showWarningModal]);

  const resetTimer = useCallback(() => {
    if (showWarningRef.current) return; // ✅ check ref instead of state
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(showWarningModal, IDLE_TIMEOUT);
  }, [showWarningModal]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(warningRef.current);
      clearInterval(countdownRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer]);

  return { showWarning, secondsLeft, stayLoggedIn };
}