import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { FaUser, FaPhoneAlt, FaLock } from "react-icons/fa";
import'../index.css';

const Login = () => {
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const internalEmail = `${studentCode}@university.com`;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, internalEmail, password);
      const user = userCredential.user;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/student");
        }
      }
    } catch (err) {
      console.error(err.code);
      setError("Invalid ID or Password.");
    }
  };

  return (
    


<div className="wrapper">
    <div className="form-box register">
      <form onSubmit={handleSubmit }>
        <h1>login</h1>

        

        <div className="input-box">
          <input
            type="text"
            placeholder="Student ID"
            required
            onChange={(e) => setStudentCode(e.target.value)}
          />
          <FaUser className="icon" />
        </div>

       

        <div className="input-box">
          <input
            type="password"
            placeholder="Password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          <FaLock className="icon" />
        </div>

        

        {error && <p className="error-message">{error}</p>}

      
             <button type="submit">login</button>
             <div className="register-link">
                <p>Don't have an account? <Link to="/register">Register</Link></p>
             </div>
      </form>
    </div>
  </div>
  );
};

export default Login;