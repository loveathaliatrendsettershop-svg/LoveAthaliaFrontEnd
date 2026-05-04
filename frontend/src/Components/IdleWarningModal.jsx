import React from 'react';

export default function IdleWarningModal({ secondsLeft, onStayLoggedIn }) {
  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      background:      'rgba(0,0,0,0.5)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      zIndex:          99999,
    }}>
      <div style={{
        background:    '#fff',
        borderRadius:  12,
        padding:       32,
        width:         340,
        textAlign:     'center',
        boxShadow:     '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Icon */}
        <div style={{
          width:          72,
          height:         72,
          borderRadius:   '50%',
          background:     'rgba(230,126,34,0.10)',
          border:         '2px solid rgba(230,126,34,0.35)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          margin:         '0 auto 16px',
        }}>
          <span className="material-icons" style={{ fontSize: 36, color: '#e67e22' }}>
            access_time
          </span>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Still there?
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.55)', marginBottom: 6 }}>
          You've been inactive for a while.
        </p>
        <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.55)', marginBottom: 24 }}>
          You will be automatically logged out in{' '}
          <strong style={{ color: '#e67e22' }}>{secondsLeft}s</strong>
        </p>

        <button
          onClick={onStayLoggedIn}
          style={{
            width:         '100%',
            padding:       '10px 0',
            background:    '#e67e22',
            color:         '#fff',
            border:        'none',
            borderRadius:  8,
            fontSize:      14,
            fontWeight:    600,
            cursor:        'pointer',
          }}
        >
          Stay Logged In
        </button>
      </div>
    </div>
  );
}