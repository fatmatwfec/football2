import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../firebase"; // تأكد من أن مسار ملف firebase صحيح
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
            // هذه الدالة هي المسؤولة عن إرسال الرابط للإيميل
            await sendPasswordResetEmail(auth, email);
            setMessage("Done , Do not Forget Your password again ");
            setEmail("");
        } catch (err) {
            console.error(err);
            if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
                setError("Invalid Email");
            } else {
                setError("Something wrong happend. Try Again ");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="FBForm">
            <div className="FormBox">
                <h2 className="Title"> Forget password </h2>
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

                    {error && <div className="ErrMsg">Something wrong happend</div>}
                    {message && <div className="msg"><p> Done , Do not Forget Your password again </p></div>}

                    <button type="submit" disabled={isLoading}>
                        {isLoading ? "Sending....." : "Send Reset Link"}
                    </button>
                </form>
                <Link to="/login">
                    Ready to Login
                </Link>
            </div>
        </div>
    );
};

export default ForgotPassword;