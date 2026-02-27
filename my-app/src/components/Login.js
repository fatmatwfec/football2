import { auth, db } from "../firebase"; 
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { doc,getDoc } from "firebase/firestore"
//import { collection, query, where, getDocs} from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import back from './back.jpg';

function Login() {
  const navigate = useNavigate(); 
  const [password, setPassword] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
  e.preventDefault();
  setError('');

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
    } else {
      setError("User profile not found.");
    }

  } catch (error) {
    console.error("Error code:", error.code);
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      setError("Invalid ID or Password.");
    } else {
      setError("Login failed, please try again.");
    }
  }
};

  return (
     
    <div style={{ padding: "280px", textAlign: "center", maxWidth: "1100px", margin: "auto",backgroundImage: `url(${back})`,backgroundSize: "cover" }}>
      
      <h2 >logIn</h2>
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <input 
          type="text" 
          placeholder="id" 
          style={{ width: '35%', padding: '10px', marginBottom: '10px' }}
          onChange={(e) => setStudentCode(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          style={{ width: '35%', padding: '10px', marginBottom: '10px' }}
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        
        {error && <p style={{ color: '#ff4d4d', fontSize: '13px' }}>{error}</p>}
        
        <button type="submit" style={{ padding: '10px 30px',color:'#000000', cursor: 'pointer',background:'#0ebc70' }}>Login</button>
      </form>
      <br />
      <Link to="/register">Don't have an account? Create one</Link>
    </div>
  );
}

export default Login;