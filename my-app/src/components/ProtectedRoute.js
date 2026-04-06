import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

const ProtectedRoute = ({ children, allowedRole }) => {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedRole = localStorage.getItem("role");

    if (storedRole) {
      setRole(storedRole);
    }

    setLoading(false);
  }, []);

  // 🟡 استنى لحد ما يقرأ من localStorage
  if (loading) {
    return <div>Loading...</div>;
  }

  // 🔴 لو مفيش role
  if (!role) {
    return <Navigate to="/login" replace />;
  }

  // 🔴 لو مش نفس الصلاحية
  if (allowedRole && role !== allowedRole) {
    return <Navigate to="/login" replace />;
  }

  // ✅ تمام
  return children;
};

export default ProtectedRoute;