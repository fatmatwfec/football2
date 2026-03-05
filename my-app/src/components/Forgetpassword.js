import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../firebase"; 
import { sendPasswordResetEmail } from "firebase/auth";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        setIsLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Check your inbox for reset link!");
            setEmail("");
        } catch (err) {
            console.error(err);
            if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
                setError("Invalid Email");
            } else {
                setError("Try Again");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container"> 
            <div className="FBForm">
                <div className="FormBox">
                    <h2 className="Title">Forget password</h2>
                    <form onSubmit={handleResetPassword}>
                        <div className="InputBox">
                            <input
                                type="email"
                                placeholder="Enter Your Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                dir="ltr"
                            />
                        </div>

                        {error && <div className="ErrMsg">{error}</div>}
                        {message && <div className="msg">{message}</div>}

                        <button
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? "Sending....." : "Send Reset Link"}
                        </button>
                    </form>
                    <Link to="/login" className="back-link">
                        Ready to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;