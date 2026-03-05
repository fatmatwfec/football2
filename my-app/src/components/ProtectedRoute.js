import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, userRole, allowedRole, loading }) => {

  if (loading) {
    return <div>Loading...</div>; 
  }

  if (!userRole) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && userRole !== allowedRole) {
    return <Navigate to="/login" replace />;
  }


  return children;
};

export default ProtectedRoute;