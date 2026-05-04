import { Navigate } from 'react-router-dom';
import useIdleLogout from './hooks/useIdleLogout';
import IdleWarningModal from './IdleWarningModal';

const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem('user');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AuthenticatedRoute>{children}</AuthenticatedRoute>;
};

function AuthenticatedRoute({ children }) {
  const { showWarning, secondsLeft, stayLoggedIn } = useIdleLogout();

  return (
    <>
      {showWarning && (
        <IdleWarningModal
          secondsLeft={secondsLeft}
          onStayLoggedIn={stayLoggedIn}
        />
      )}
      {children}
    </>
  );
}

export default ProtectedRoute;