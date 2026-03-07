import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { FaUser, FaLock } from "react-icons/fa";
import '../index.css';

const Login = () => {
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const q = query(collection(db, "users"), where("studentCode", "==", studentCode.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("This Student ID is not registered.");
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userEmail = userData.email;

      const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
      const user = userCredential.user;

      const isManuallyVerified = userData.isVerified === true;

      if (!user.emailVerified && !isManuallyVerified) {
        setError("Please verify your university email or contact admin for manual activation.");
        await signOut(auth);
        return;
      }

      navigate(userData.role === "admin" ? "/admin" : "/student");

    } catch (err) {
      console.error(err.code);
      setError("Invalid ID or Password.");
    }
  };

  return (
    <div className="auth-container">
      <div className="wrapper">
        <div className="form-box login">
          <form onSubmit={handleSubmit}>
            <h1>Login</h1>
            <div className="input-box">
              <input type="text" placeholder="Student ID" required onChange={(e) => setStudentCode(e.target.value)} />
              <FaUser className="icon" />
            </div>
            <div className="input-box">
              <input type="password" placeholder="Password" required onChange={(e) => setPassword(e.target.value)} />
              <FaLock className="icon" />
              <p> <Link to="/Forgetpassword"> <em className="Forgetpassword"> Forget Password ?</em> </Link> </p>
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit">Login</button>
            <div className="register-link">
              <p>Don't have an account? <Link to="/register">Register</Link></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
export default Login;