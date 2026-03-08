import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./authentication/Login";
import AuthService from "./authentication/AuthService";
import RouteBuilder from "./components/RouteBuilder";
import Register from "./authentication/Register.jsx"; // Your main map component

// 🔒 Guard Component: Only allows access if logged in
const PrivateRoute = ({ children }) => {
    const user = AuthService.getCurrentUser();
    return user ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <Router>
            <Routes>
                {/* Public Route: Login */}
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Route: Dashboard (The Map) */}
                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <RouteBuilder />
                        </PrivateRoute>
                    }
                />

                {/* Default Redirect: Go to Dashboard (which will kick to Login if needed) */}
                <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
        </Router>
    );
}

export default App;