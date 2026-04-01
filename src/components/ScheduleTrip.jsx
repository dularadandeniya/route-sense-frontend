import React, { useState, useEffect } from "react";
import {
    MapContainer,
    TileLayer,
    Polyline,
    Marker,
    Popup,
    useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import LocationPicker from "./LocationPicker";
import api from "../axiosInstance.js";
import AuthService from "../authentication/AuthService.js";

// ---------- Icons ----------
const createIcon = (color) => {
    return new L.Icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
};

const GreenIcon = createIcon("green");
const RedIcon = createIcon("red");

// Custom Numbered Icon for Stops
const createNumberIcon = (num) =>
    L.divIcon({
        className: "custom-number-icon",
        html: `
      <div style="
        background-color: #ffc107; 
        width: 30px; height: 30px; 
        border-radius: 50%; 
        border: 2px solid white;
        box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        display: flex; justify-content: center; align-items: center; 
        font-weight: bold; color: #333; font-size: 14px;
      ">
        ${num}
      </div>
    `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -20]
    });

// ---------- Map helpers ----------
const FitBounds = ({ routes }) => {
    const map = useMap();

    useEffect(() => {
        if (!routes || routes.length === 0) return;

        const validRoute = routes.find((r) => r.route_sequence?.length > 0);
        if (!validRoute) return;

        const bounds = validRoute.route_sequence.map((p) => [
            parseFloat(p.lat),
            parseFloat(p.lon),
        ]);

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [routes, map]);

    return null;
};

const RouteLegend = () => (
    <div
        style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 999,
            background: "white",
            padding: "10px 12px",
            borderRadius: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: 13,
            minWidth: 180,
        }}
    >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Legend</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 34, height: 5, background: "#0d6efd", borderRadius: 3 }} />
            <span>Recommended</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 0, borderTop: "5px dashed #6c757d" }} />
            <span>Comparisons</span>
        </div>
    </div>
);

// ---------- Main component ----------
const ScheduleTrip = () => {
    const [form, setForm] = useState({
        tripName: "",
        start: null,
        end: null,
        stops: [],
        departureDate: "",
        departureTime: "",
        weightKg: 50,
        vehicleType: "MEDIUM",
    });

    const [pickerState, setPickerState] = useState({ isOpen: false, activeField: null });
    const [schedules, setSchedules] = useState([]);
    const [message, setMessage] = useState("");

    const [optimizedRoutes, setOptimizedRoutes] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [selectedScheduleMeta, setSelectedScheduleMeta] = useState(null);
    const [optimizing, setOptimizing] = useState(false);

    // --- NEW EMAIL MODAL STATES ---
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [driverEmail, setDriverEmail] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailSuccess, setEmailSuccess] = useState(false);

    useEffect(() => {
        loadSchedules();
    }, []);

    const loadSchedules = async () => {
        try {
            const res = await api.get("/api/schedules");
            setSchedules(res.data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const openPicker = (field) => setPickerState({ isOpen: true, activeField: field });

    const handleLocationPicked = (location) => {
        const field = pickerState.activeField;

        if (field === "start") {
            setForm((prev) => ({ ...prev, start: location }));
        } else if (field === "end") {
            setForm((prev) => ({ ...prev, end: location }));
        } else if (field.startsWith("stop-")) {
            const stopId = parseInt(field.split("-")[1], 10);
            const updatedStops = form.stops.map((s) =>
                s.id === stopId ? { ...s, location } : s
            );
            setForm((prev) => ({ ...prev, stops: updatedStops }));
        }

        setPickerState({ isOpen: false, activeField: null });
    };

    const addStop = () => {
        setForm((prev) => ({
            ...prev,
            stops: [...prev.stops, { id: Date.now(), location: null }],
        }));
    };

    const removeStop = (id) => {
        setForm((prev) => ({
            ...prev,
            stops: prev.stops.filter((s) => s.id !== id),
        }));
    };

    const handleSave = async () => {
        if (!form.start || !form.end || !form.departureDate || !form.departureTime) {
            alert("Please fill required fields.");
            return;
        }

        const payload = {
            tripName: form.tripName,
            startName: form.start.name,
            startLat: form.start.lat,
            startLon: form.start.lon,
            endName: form.end.name,
            endLat: form.end.lat,
            endLon: form.end.lon,
            departureTime: `${form.departureDate}T${form.departureTime}:00`,
            weightKg: Number(form.weightKg),
            vehicleType: form.vehicleType,
            stops: form.stops
                .filter((s) => s.location)
                .map((s) => ({
                    name: s.location.name,
                    latitude: s.location.lat,
                    longitude: s.location.lon,
                })),
        };

        try {
            await api.post("/api/schedules", payload);
            setMessage("Scheduled trip saved successfully.");
            loadSchedules();

            setForm({
                tripName: "",
                start: null,
                end: null,
                stops: [],
                departureDate: "",
                departureTime: "",
                weightKg: 50,
                vehicleType: "MEDIUM",
            });
        } catch (e) {
            console.error(e);
            setMessage("Failed to save schedule.");
        }
    };

    const handleOptimize = async (schedule) => {
        try {
            setOptimizing(true);

            const res = await api.post(`/api/schedules/${schedule.id}/optimize`);

            const routes = res.data || [];
            setOptimizedRoutes(routes);
            setSelectedRoute(routes.length > 0 ? routes[0] : null);
            setSelectedScheduleMeta(schedule);
            setMessage("Scheduled trip optimized successfully.");

            console.log("Scheduled optimization results", routes);
        } catch (e) {
            console.error(e);
            setMessage("Optimization failed.");
            setOptimizedRoutes([]);
            setSelectedRoute(null);
            setSelectedScheduleMeta(null);
        } finally {
            setOptimizing(false);
        }
    };

    const isSameRoute = (a, b) => {
        if (!a || !b) return false;
        return (
            a.mode === b.mode &&
            a.time_seconds === b.time_seconds &&
            a.co2_emissions === b.co2_emissions
        );
    };

    // --- REAL API EMAIL FUNCTION ---
    const handleRealEmailSend = async () => {
        if (!driverEmail.includes("@")) {
            alert("Please enter a valid email address.");
            return;
        }

        setIsSendingEmail(true);

        const stopsList = selectedRoute.stop_order ? selectedRoute.stop_order.join(' ➔ ') : 'Direct Route';
        const timeMins = Math.round(selectedRoute.time_seconds / 60);

        const payload = {
            driverEmail: driverEmail,
            mode: selectedRoute.mode,
            time: timeMins.toString(),
            stops: stopsList
        };

        try {
            // Send the real request to your Spring Boot backend
            await api.post("/api/email/send-route", payload);

            setIsSendingEmail(false);
            setEmailSuccess(true);

            // Close the modal automatically
            setTimeout(() => {
                setShowEmailModal(false);
                setEmailSuccess(false);
                setDriverEmail("");
            }, 2000);
        } catch (error) {
            console.error("Email failed:", error);
            alert("Failed to send email. Please check the Spring Boot console for errors.");
            setIsSendingEmail(false);
        }
    };

    const selectedRoutePositions =
        selectedRoute?.route_sequence?.map((p) => [
            parseFloat(p.lat),
            parseFloat(p.lon),
        ]) || [];

    const routeStartPosition =
        selectedRoutePositions.length > 0 ? selectedRoutePositions[0] : null;

    const routeEndPosition =
        selectedRoutePositions.length > 1
            ? selectedRoutePositions[selectedRoutePositions.length - 1]
            : null;

    // --- EMAIL MODAL UI COMPONENT ---
    const EmailModal = () => {
        if (!showEmailModal) return null;

        return (
            <div style={{
                position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999,
                display: "flex", justifyContent: "center", alignItems: "center"
            }}>
                <div className="card shadow-lg border-0" style={{ width: "400px", borderRadius: "15px" }}>
                    <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center border-0" style={{ borderTopLeftRadius: "15px", borderTopRightRadius: "15px" }}>
                        <h6 className="mb-0 fw-bold">✉️ Dispatch Route to Driver</h6>
                        <button className="btn-close btn-close-white" onClick={() => setShowEmailModal(false)} disabled={isSendingEmail}></button>
                    </div>
                    <div className="card-body p-4 text-center">
                        {emailSuccess ? (
                            <div className="py-3">
                                <div className="text-success mb-2" style={{ fontSize: "40px" }}>✅</div>
                                <h5 className="fw-bold text-success">Route Dispatched!</h5>
                                <p className="text-muted small">The driver has received the optimal sequence and live traffic data.</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-muted small mb-3 text-start">
                                    Send the optimized <strong>{selectedRoute?.mode}</strong> sequence directly to your driver's device.
                                </p>
                                <div className="mb-4 text-start">
                                    <label className="fw-bold small mb-1">Driver Email Address</label>
                                    <input
                                        type="email"
                                        className="form-control bg-light"
                                        placeholder="driver@logistics.com"
                                        value={driverEmail}
                                        onChange={(e) => setDriverEmail(e.target.value)}
                                        disabled={isSendingEmail}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary w-100 fw-bold py-2"
                                    onClick={handleRealEmailSend}
                                    disabled={isSendingEmail || !driverEmail}
                                >
                                    {isSendingEmail ? "📡 Dispatching via SMTP..." : "Send Route Details"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container-fluid py-4">
            <EmailModal />

            {pickerState.isOpen && (
                <LocationPicker
                    onClose={() => setPickerState({ isOpen: false, activeField: null })}
                    onConfirm={handleLocationPicked}
                />
            )}

            <div className="row g-4">
                {/* Left column */}
                <div className="col-lg-4">
                    <div className="card p-3 mb-4">
                        <h3 className="mb-3">📅 Scheduled Trip Planning</h3>

                        <div className="d-flex justify-content-between mb-3">
                            <a href="/dashboard" className="btn btn-sm btn-outline-primary">Route Builder</a>
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => { AuthService.logout(); window.location.href = "/login"; }}
                            >
                                Logout
                            </button>
                        </div>

                        <div className="mb-2">
                            <label>Trip Name</label>
                            <input
                                className="form-control"
                                value={form.tripName}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, tripName: e.target.value }))
                                }
                            />
                        </div>

                        <div className="mb-2">
                            <label>Start</label>
                            <div className="input-group">
                                <input className="form-control" readOnly value={form.start?.name || ""} />
                                <button
                                    className="btn btn-outline-success"
                                    onClick={() => openPicker("start")}
                                >
                                    📍
                                </button>
                            </div>
                        </div>

                        <div className="mb-2">
                            <label>End</label>
                            <div className="input-group">
                                <input className="form-control" readOnly value={form.end?.name || ""} />
                                <button
                                    className="btn btn-outline-danger"
                                    onClick={() => openPicker("end")}
                                >
                                    📍
                                </button>
                            </div>
                        </div>

                        <div className="mb-2">
                            <div className="d-flex justify-content-between">
                                <label>Stops</label>
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={addStop}
                                >
                                    + Add
                                </button>
                            </div>

                            {form.stops.map((s, i) => (
                                <div className="d-flex gap-2 mt-2" key={s.id}>
                                    <span className="pt-2 small fw-bold">{i + 1}.</span>
                                    <input
                                        className="form-control"
                                        readOnly
                                        value={s.location?.name || ""}
                                    />
                                    <button
                                        className="btn btn-outline-secondary"
                                        onClick={() => openPicker(`stop-${s.id}`)}
                                    >
                                        📍
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => removeStop(s.id)}
                                    >
                                        x
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-2">
                                <label>Departure Date</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={form.departureDate}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, departureDate: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="col-md-6 mb-2">
                                <label>Departure Time</label>
                                <input
                                    type="time"
                                    className="form-control"
                                    value={form.departureTime}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, departureTime: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-2">
                                <label>Payload (kg)</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={form.weightKg}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, weightKg: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="col-md-6 mb-2">
                                <label>Vehicle Type</label>
                                <select
                                    className="form-select"
                                    value={form.vehicleType}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, vehicleType: e.target.value }))
                                    }
                                >
                                    <option value="LIGHT">LIGHT</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                    <option value="HEAVY">HEAVY</option>
                                </select>
                            </div>
                        </div>

                        <button className="btn btn-primary mt-2" onClick={handleSave}>
                            Save Schedule
                        </button>

                        {message && <div className="alert alert-info mt-3">{message}</div>}
                    </div>

                    <div className="card p-3 mb-4">
                        <h5>Saved Schedules</h5>
                        {schedules.map((s) => (
                            <div
                                key={s.id}
                                className="border rounded p-2 mb-2 d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <strong>{s.tripName || `Trip #${s.id}`}</strong>
                                    <br />
                                    <small>
                                        {new Date(s.departureTime).toLocaleString()} | {s.status}
                                    </small>
                                </div>
                                <button
                                    className="btn btn-warning btn-sm"
                                    onClick={() => handleOptimize(s)}
                                    disabled={optimizing}
                                >
                                    {optimizing ? "..." : "Optimize"}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* POLISHED RESULTS CARD */}
                    {selectedRoute && (
                        <div className="card border-0 shadow-lg mt-4" style={{ borderRadius: "15px", overflow: "hidden" }}>
                            <div className="card-header bg-primary text-white p-3 border-0 d-flex justify-content-between align-items-center">
                                <span className="fw-bold mb-0">📋 Optimized Route Ready</span>
                                {selectedRoute.avg_traffic_factor && (
                                    <span className="badge bg-light text-primary">
                                        Traffic: {Number(selectedRoute.avg_traffic_factor).toFixed(2)}x
                                    </span>
                                )}
                            </div>
                            <div className="card-body p-4 bg-light">
                                <h5 className="card-title fw-bold text-dark mb-2">{selectedRoute.mode}</h5>
                                <p className="card-text small text-muted mb-4 border-start border-3 border-primary ps-2">
                                    {selectedRoute.explanation}
                                </p>

                                <div className="row text-center mb-4 g-2">
                                    <div className="col-4">
                                        <div className="p-2 bg-white rounded shadow-sm border">
                                            <small className="text-muted d-block text-uppercase fw-bold" style={{fontSize:"10px"}}>Est. Time</small>
                                            <strong className="fs-5 text-primary">{(selectedRoute.time_seconds / 60).toFixed(0)} <span className="fs-6">min</span></strong>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="p-2 bg-white rounded shadow-sm border">
                                            <small className="text-muted d-block text-uppercase fw-bold" style={{fontSize:"10px"}}>CO2 Impact</small>
                                            <strong className="fs-5 text-success">{selectedRoute.co2_emissions.toFixed(1)} <span className="fs-6">kg</span></strong>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="p-2 bg-white rounded shadow-sm border">
                                            <small className="text-muted d-block text-uppercase fw-bold" style={{fontSize:"10px"}}>Fuel Cost</small>
                                            <strong className="fs-5 text-danger"><span className="fs-6">Rs.</span> {selectedRoute.cost_currency.toFixed(0)}</strong>
                                        </div>
                                    </div>
                                </div>

                                {selectedRoute.stop_order?.length > 0 && (
                                    <div className="mb-4 p-3 bg-white rounded shadow-sm border">
                                        <small className="text-muted fw-bold text-uppercase mb-2 d-block" style={{fontSize:"10px"}}>Optimal Stop Sequence</small>
                                        <div className="d-flex flex-wrap gap-2 align-items-center">
                                            {selectedRoute.stop_order.map((stop, idx) => (
                                                <React.Fragment key={idx}>
                                                    <span className="badge bg-secondary text-white p-2">{idx + 1}. {stop}</span>
                                                    {idx < selectedRoute.stop_order.length - 1 && <span className="text-muted">➔</span>}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    className="btn btn-success w-100 py-2 fw-bold shadow-sm"
                                    onClick={() => setShowEmailModal(true)}
                                >
                                    ✉️ Email to Driver
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="col-lg-8">
                    <div
                        className="card shadow-lg border-0"
                        style={{
                            position: "sticky",
                            top: "1.5rem",
                            height: "calc(100vh - 3rem)",
                            overflow: "hidden",
                            borderRadius: "15px"
                        }}
                    >
                        <MapContainer
                            center={[6.9271, 79.8612]}
                            zoom={13}
                            style={{ height: "100%", width: "100%", zIndex: 1 }}
                        >
                            <TileLayer
                                url="http://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                                attribution="&copy; Google Maps"
                            />

                            <FitBounds routes={optimizedRoutes} />

                            {routeStartPosition && (
                                <Marker position={routeStartPosition} icon={GreenIcon}>
                                    <Popup>
                                        Start: {selectedRoute?.stop_order?.[0] || "Start"}
                                    </Popup>
                                </Marker>
                            )}

                            {routeEndPosition && (
                                <Marker position={routeEndPosition} icon={RedIcon}>
                                    <Popup>
                                        End:{" "}
                                        {selectedRoute?.stop_order?.[
                                        selectedRoute.stop_order.length - 1
                                            ] || "End"}
                                    </Popup>
                                </Marker>
                            )}

                            {/* DRAW NUMBERED STOPS ON MAP */}
                            {form.stops.map((s, i) => {
                                if (s.location) {
                                    // Find optimized order index if available
                                    let displayNum = i + 1;
                                    if (selectedRoute && selectedRoute.stop_order) {
                                        const optIndex = selectedRoute.stop_order.indexOf(s.location.name);
                                        // -1 because stop_order[0] is start point
                                        if (optIndex > 0 && optIndex < selectedRoute.stop_order.length - 1) {
                                            displayNum = optIndex;
                                        }
                                    }
                                    return (
                                        <Marker
                                            key={s.id}
                                            position={[s.location.lat, s.location.lon]}
                                            icon={createNumberIcon(displayNum)}
                                        >
                                            <Popup><b>Stop {displayNum}</b>: {s.location.name}</Popup>
                                        </Marker>
                                    );
                                }
                                return null;
                            })}

                            {optimizedRoutes.map((route, index) => {
                                const positions = (route.route_sequence || []).map((p) => [
                                    parseFloat(p.lat),
                                    parseFloat(p.lon),
                                ]);

                                if (positions.length === 0) return null;

                                const isRecommended = route.mode?.includes("Recommended");
                                const selected = isSameRoute(selectedRoute, route);

                                const dimOthers = !!selectedRoute;
                                const opacity = !dimOthers
                                    ? isRecommended
                                        ? 0.95
                                        : 0.75
                                    : selected
                                        ? 0.95
                                        : 0.25;

                                const weight = selected
                                    ? isRecommended
                                        ? 9
                                        : 7
                                    : isRecommended
                                        ? 8
                                        : 6;

                                const color = isRecommended ? "#0d6efd" : "#343a40";

                                return (
                                    <Polyline
                                        key={index}
                                        positions={positions}
                                        pathOptions={{
                                            color,
                                            weight,
                                            opacity,
                                            dashArray: isRecommended ? null : "8 10",
                                        }}
                                        eventHandlers={{
                                            click: () => setSelectedRoute(route),
                                        }}
                                    >
                                        <Popup>
                                            <strong>{route.mode}</strong>
                                            <br />
                                            Time: {(route.time_seconds / 60).toFixed(0)} min
                                            <br />
                                            CO2: {route.co2_emissions.toFixed(2)} kg
                                            <br />
                                            Traffic:{" "}
                                            {route.avg_traffic_factor
                                                ? `${Number(route.avg_traffic_factor).toFixed(2)}x`
                                                : "N/A"}
                                        </Popup>
                                    </Polyline>
                                );
                            })}

                            <RouteLegend />
                        </MapContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleTrip;