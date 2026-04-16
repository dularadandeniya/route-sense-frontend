import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthService from "./AuthService";
import "./Auth.css"; // Import the styles
import { MapPin } from "lucide-react";

const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await AuthService.login(username, password);
            navigate("/dashboard");
        } catch (err) {
            setError("Invalid username or password");
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="text-center mb-4">
                    <MapPin size={36} className="text-primary mb-2" />
                    <h3 className="fw-bold mb-1">Welcome to RouteSense</h3>
                    <p className="text-muted small">Please log in to continue</p>
                </div>

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