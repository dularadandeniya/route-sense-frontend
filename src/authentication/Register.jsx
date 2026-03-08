import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "./AuthService";
import "./Auth.css";

const Register = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [isError, setIsError] = useState(false);

    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setMessage("");
        setIsError(false);

        try {
            await AuthService.register(username, email, password);
            setMessage("Account created! Please log in.");
            setIsError(false);

            // Go to login page after 2 seconds
            setTimeout(() => {
                navigate("/login");
            }, 2000);

        } catch (err) {
            setMessage("❌ Username or Email already exists");
            setIsError(true);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Create Account 🚀</h2>
                <p className="auth-subtitle">Join RouteSense today</p>

                {message && (
                    <div className={isError ? "auth-alert" : "alert alert-success"}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleRegister}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            className="form-control"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            className="form-control"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-auth">Sign Up</button>
                </form>

                <p className="auth-footer" style={{ marginTop: "15px", textAlign: "center" }}>
                    Already have an account? {" "}
                    <span
                        style={{ color: "#007bff", cursor: "pointer", fontWeight: "bold" }}
                        onClick={() => navigate("/login")}>Log In</span>
                </p>
            </div>
        </div>
    );
};

export default Register;