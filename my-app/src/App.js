import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import Register from './components/Register';
import Login from './components/Login';
import AdminDashboard from './Dashboard/AdminDashboard';
import StudentDashboard from './Dashboard/StudentDashboard';
import Forgetpassword from './components/Forgetpassword';
import ProtectedRoute from './components/ProtectedRoute'; 

function App() {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/Forgetpassword" element={<Forgetpassword />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute userRole={userRole} allowedRole="admin" loading={loading}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/student" 
            element={
              <ProtectedRoute userRole={userRole} allowedRole="student" loading={loading}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;