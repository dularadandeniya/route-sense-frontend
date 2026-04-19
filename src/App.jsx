import React from "react";
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";
import Login from "./authentication/Login";
import AuthService from "./authentication/AuthService";
import RouteBuilder from "./components/RouteBuilder";
import Register from "./authentication/Register.jsx";
import ScheduleTrip from "./components/ScheduleTrip.jsx";
import BulkSchedule from "./components/BulkSchedule.jsx";

const PrivateRoute = ({children}) => {
    const user = AuthService.getCurrentUser();
    return user ? children : <Navigate to="/login"/>;
};

function App() {
    return (
        <Router>
            <Routes>

                <Route path="/login" element={<Login/>}/>
                <Route path="/register" element={<Register/>}/>

                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <RouteBuilder/>
                        </PrivateRoute>
                    }
                />

                <Route
                    path="/schedules"
                    element={
                        <PrivateRoute>
                            <ScheduleTrip/>
                        </PrivateRoute>
                    }
                />

                <Route path="/bulk-schedule" element={<PrivateRoute><BulkSchedule/></PrivateRoute>}/>

                <Route path="*" element={<Navigate to="/dashboard"/>}/>
            </Routes>
        </Router>
    );
}

export default App;