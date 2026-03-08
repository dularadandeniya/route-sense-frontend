import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "./AuthService";
import "./Auth.css"; // Import the styles

const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await AuthService.login(username, password);
            navigate("/dashboard"); // 🔀 Redirect to Dashboard
            window.location.reload(); // Refresh to update state
        } catch (err) {
            setError("❌ Invalid username or password");
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Welcome to RouteSense 📍</h2>
                <p className="auth-subtitle">Please log in to continue</p>

                {error && <div className="auth-alert">{error}</div>}

                <form onSubmit={handleLogin}>
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
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-auth">Login</button>
                </form>

                <p className="auth-footer" style={{ marginTop: "15px", textAlign: "center" }}>
                    Don't have an account?{" "}
                    <span
                        style={{ color: "#007bff", cursor: "pointer", fontWeight: "bold" }}
                        onClick={() => navigate("/register")}
                    >
            Sign Up
          </span>
                </p>
            </div>
        </div>
    );
};

export default Login;