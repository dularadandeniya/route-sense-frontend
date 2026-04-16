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
import RouteAnimator from "./RouteAnimator";
import LocationPicker from "./LocationPicker";
import api from "../axiosInstance.js";
import AuthService from "../authentication/AuthService.js";
import {Link} from "react-router-dom";
import { GreenPin, RedPin, createNumberIcon } from "./MapIcons.js";
import {Truck, LogOut, Mail, X, CheckCircle2, Loader2, Send, MapPin,ArrowRight, Navigation , Plus, Circle, Play, Weight ,Activity  } from "lucide-react";

// --- 2. HELPER COMPONENTS ---

const FitBounds = ({ routes }) => {
    const map = useMap();
    useEffect(() => {
        if (!routes || routes.length === 0) return;
        const validRoute = routes.find((r) => r.route_sequence?.length > 0);
        if (validRoute) {
            const bounds = validRoute.route_sequence.map((p) => [
                parseFloat(p.lat),
                parseFloat(p.lon),
            ]);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [routes, map]);
    return null;
};

const RouteLegend = () => (
    <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 999,
        background: "white", padding: "10px 12px", borderRadius: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: 13, minWidth: 170,
    }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Legend</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 34, height: 5, background: "#0d6efd", borderRadius: 3 }} />
            <span>Recommended</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 34, height: 0, borderTop: "5px dashed #6c757d" }} />
            <span>Alternatives</span>
        </div>
    </div>
);

// --- 3. MAIN COMPONENT ---

const RouteBuilder = () => {
    // Application State
    const [request, setRequest] = useState({
        start: null,
        end: null,
        stops: [],
        weightKg: 50.0,
        vehicleType: "MEDIUM",
    });

    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [calculatedTrafficFactor, setCalculatedTrafficFactor] = useState(null);
    const [showTrafficFactor, setShowTrafficFactor] = useState(false);

    // Picker Modal State
    const [pickerState, setPickerState] = useState({ isOpen: false, activeField: null });

    // --- EMAIL MODAL STATES ---
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [driverEmail, setDriverEmail] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailSuccess, setEmailSuccess] = useState(false);

    // --- HANDLERS ---
    const openPicker = (field) => {
        setPickerState({ isOpen: true, activeField: field });
    };

    const handleLocationPicked = (location) => {
        const field = pickerState.activeField;

        if (field === "start") {
            setRequest((prev) => ({ ...prev, start: location }));
        } else if (field === "end") {
            setRequest((prev) => ({ ...prev, end: location }));
        } else if (field.startsWith("stop-")) {
            const stopId = parseInt(field.split("-")[1]);
            const updatedStops = request.stops.map((s) =>
                s.id === stopId ? { ...s, location: location } : s
            );
            setRequest((prev) => ({ ...prev, stops: updatedStops }));
        }
        setPickerState({ isOpen: false, activeField: null });
    };

    const addStop = () => {
        setRequest((prev) => ({
            ...prev,
            stops: [...prev.stops, { id: Date.now(), location: null }],
        }));
    };

    const removeStop = (id) => {
        setRequest((prev) => ({
            ...prev,
            stops: prev.stops.filter((s) => s.id !== id),
        }));
    };

    const handleOptimize = async () => {
        if (!request.start || !request.end) {
            alert("Please select Start and End locations!");
            return;
        }

        setLoading(true);

        const payload = {
            startLat: request.start.lat,
            startLon: request.start.lon,
            startName: request.start.name,
            endLat: request.end.lat,
            endLon: request.end.lon,
            endName: request.end.name,
            weightKg: parseFloat(request.weightKg),
            vehicleType: request.vehicleType,
            stops: request.stops
                .filter((s) => s.location)
                .map((s) => ({
                    name: s.location.name,
                    latitude: s.location.lat,
                    longitude: s.location.lon,
                })),
        };

        try {
            const res = await api.post("/api/routes/optimize", payload);
            setRoutes(res.data || []);

            if (res.data?.length > 0) {
                setSelectedRoute(res.data[0]);
                setCalculatedTrafficFactor(res.data[0].avg_traffic_factor ?? null);
                setShowTrafficFactor(true);
            } else {
                setSelectedRoute(null);
                setCalculatedTrafficFactor(null);
                setShowTrafficFactor(false);
            }
        } catch (err) {
            setCalculatedTrafficFactor(null);
            setShowTrafficFactor(false);
            console.error(err);
            alert("Error: " + (err.response?.data?.error || err.message));
        }

        setLoading(false);
    };

    const isSameRoute = (a, b) => {
        if (!a || !b) return false;
        return (
            a.mode === b.mode &&
            a.time_seconds === b.time_seconds &&
            a.co2_emissions === b.co2_emissions
        );
    };

    const formatTime = (seconds) => {
        const totalMinutes = Math.round(seconds / 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

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
            await api.post("/api/email/send-route", payload);
            setIsSendingEmail(false);
            setEmailSuccess(true);
            setTimeout(() => {
                setShowEmailModal(false);
                setEmailSuccess(false);
                setDriverEmail("");
            }, 2000);
        } catch (error) {
            console.error("Email failed:", error);
            alert("Failed to send email. Please check server logs.");
            setIsSendingEmail(false);
        }
    };

    // --- EMAIL MODAL UI ---
    const EmailModal = () => {
        if (!showEmailModal) return null;

        return (
            <div style={{
                position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999,
                display: "flex", justifyContent: "center", alignItems: "center"
            }}>
                <div className="card shadow-lg border-0" style={{ width: "400px", borderRadius: "15px" }}>
                    <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center border-0"
                         style={{ borderTopLeftRadius: "15px", borderTopRightRadius: "15px" }}>
                        <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                            <Mail size={16} /> Dispatch Route to Driver
                        </h6>
                        <button
                            className="btn btn-sm btn-dark d-flex align-items-center"
                            onClick={() => setShowEmailModal(false)}
                            disabled={isSendingEmail}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="card-body p-4 text-center">
                        {emailSuccess ? (
                            <div className="py-3">
                                <CheckCircle2 size={48} className="text-success mb-2" />
                                <h5 className="fw-bold text-success">Route Dispatched!</h5>
                                <p className="text-muted small">The driver has received the optimal sequence.</p>
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
                                    {isSendingEmail ? (
                                        <><Loader2 size={14} className="spin me-1" /> Dispatching...</>
                                    ) : (
                                        <><Send size={14} className="me-1" /> Send Route Details</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container-fluid py-4" style={{ overflow: "hidden" }}>
            {/* LOCATION PICKER MODAL */}
            {pickerState.isOpen && (
                <LocationPicker
                    onClose={() => setPickerState({ isOpen: false, activeField: null })}
                    onConfirm={handleLocationPicked}
                />
            )}

            <div className="row g-4">
                {/* Left column */}
                <div className="col-lg-4">
                    <div className="card p-3 mb-4 shadow-sm" style={{ height: "auto" }}>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h4 className="text-primary mb-0 d-flex align-items-center gap-2">
                                <Truck size={22} /> RouteSense
                            </h4>
                            <div className="d-flex gap-2">
                                <Link to="/schedules" className="btn btn-sm btn-outline-primary">
                                    Schedules
                                </Link>
                                <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => { AuthService.logout(); window.location.href = "/login"; }}
                                >
                                    <LogOut size={14} /> Logout
                                </button>
                            </div>
                        </div>

                        {/* Start Point */}
                        <div className="mb-2">
                            <label className="fw-bold text-success d-flex align-items-center gap-1">
                                <Navigation size={14} className="text-success" /> Start Point
                            </label>
                            <div className="input-group">
                                <input
                                    type="text" className="form-control bg-white" readOnly
                                    value={request.start?.name || ""} placeholder="Select start..."
                                />
                                <button className="btn btn-outline-success d-flex align-items-center"
                                        onClick={() => openPicker("start")}>
                                    <MapPin size={15} />
                                </button>
                            </div>
                        </div>

                        {/* End Point */}
                        <div className="mb-2">
                            <label className="fw-bold text-danger d-flex align-items-center gap-1">
                                <MapPin size={14} className="text-danger" /> Destination
                            </label>
                            <div className="input-group">
                                <input
                                    type="text" className="form-control bg-white" readOnly
                                    value={request.end?.name || ""} placeholder="Select destination..."
                                />
                                <button className="btn btn-danger d-flex align-items-center"
                                        onClick={() => openPicker("end")}>
                                    <MapPin size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Stops List */}
                        <div className="mb-2 border-top pt-2">
                            <div className="d-flex justify-content-between mb-1">
                                <label className="fw-bold text-warning d-flex align-items-center gap-1">
                                    <Circle size={14} className="text-warning" fill="currentColor" /> Stops
                                </label>
                                <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                        onClick={addStop}>
                                    <Plus size={13} /> Add
                                </button>
                            </div>

                            {request.stops.map((s, i) => (
                                <div key={s.id} className="d-flex gap-2 mb-2">
                                    <span className="small pt-2 fw-bold">{i + 1}.</span>
                                    <div className="input-group input-group-sm">
                                        <input
                                            type="text" className="form-control bg-white" readOnly
                                            value={s.location?.name || ""} placeholder="Pick stop..."
                                        />
                                        <button className="btn btn-outline-secondary d-flex align-items-center"
                                                onClick={() => openPicker(`stop-${s.id}`)}>
                                            <MapPin size={15} />
                                        </button>
                                    </div>
                                    <button className="btn btn-sm btn-danger d-flex align-items-center"
                                            onClick={() => removeStop(s.id)}>
                                        <X size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {showTrafficFactor && (
                            <div className="mb-2 border-top pt-2">
                                <label className="fw-bold d-flex align-items-center gap-1">
                                    <Activity size={14} className="text-warning" /> Live Traffic Factor
                                </label>
                                <input
                                    type="text"
                                    className="form-control bg-white"
                                    readOnly
                                    value={
                                        calculatedTrafficFactor !== null
                                            ? `${Number(calculatedTrafficFactor).toFixed(2)}x`
                                            : ""
                                    }
                                />
                                <small className="text-muted">
                                    Calculated dynamically from live traffic data.
                                </small>
                            </div>
                        )}

                        <div className="mb-2 border-top pt-2">
                            <label className="fw-bold d-flex align-items-center gap-1">
                                <Weight size={14} className="text-secondary" /> Payload (kg)
                            </label>
                            <input
                                type="number"
                                className="form-control"
                                value={request.weightKg}
                                onChange={(e) => setRequest((prev) => ({ ...prev, weightKg: e.target.value }))}
                            />
                        </div>

                        {/* Vehicle Controls */}
                        <div className="mb-2 border-top pt-2">
                            <label className="fw-bold d-flex align-items-center gap-1">
                                <Truck size={14} className="text-secondary" /> Vehicle Type
                            </label>
                            <select
                                className="form-select"
                                value={request.vehicleType}
                                onChange={(e) =>
                                    setRequest((prev) => ({ ...prev, vehicleType: e.target.value }))
                                }
                            >
                                <option value="LIGHT">Light Truck (≤ 2T)</option>
                                <option value="MEDIUM">Medium Truck (≤ 10T)</option>
                                <option value="HEAVY">Heavy Truck (≤ 20T)</option>
                            </select>
                        </div>

                        {/* Action Buttons */}
                        <button
                            className="btn btn-primary w-100 mt-2"
                            onClick={handleOptimize}
                            disabled={loading}
                        >
                            {loading ? "Calculating..." : "Visualize Route"}
                        </button>

                        <button className="btn btn-warning w-100 mt-2 d-flex align-items-center justify-content-center gap-2"
                                onClick={() => setIsAnimating(true)} disabled={!selectedRoute}>
                            <Play size={14} /> Simulate Delivery
                        </button>
                    </div>

                    {/* POLISHED RESULTS CARD */}
                    {selectedRoute && (
                        <div className="card border-0 shadow-lg mt-3 mb-4" style={{ borderRadius: "15px", overflow: "hidden" }}>
                            <div className="card-header bg-primary text-white p-3 border-0 d-flex justify-content-between align-items-center">
                                <span className="fw-bold mb-0"> Optimized Route Ready</span>
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
                                            <strong className="fs-5 text-primary">{formatTime(selectedRoute.time_seconds)} <span className="fs-6">min</span></strong>
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
                                            <small className="text-muted d-block text-uppercase fw-bold" style={{fontSize:"10px"}}>Fuel Cost (Est.)</small>
                                            <strong className="fs-5 text-danger"><span className="fs-6">Rs.</span> {selectedRoute.cost_currency.toFixed(0)}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* STOP ORDER LIST */}
                                {selectedRoute.stop_order?.length > 0 && (
                                    <div className="mb-4 p-3 bg-white rounded shadow-sm border">
                                        <small className="text-muted fw-bold text-uppercase mb-2 d-block" style={{fontSize:"10px"}}>Optimal Stop Sequence</small>
                                        <div className="d-flex flex-wrap gap-2 align-items-center">
                                            {selectedRoute.stop_order.map((stop, idx) => (
                                                <React.Fragment key={idx}>
                                                    <span className="badge bg-secondary text-white p-2">{idx + 1}. {stop}</span>
                                                    {idx < selectedRoute.stop_order.length - 1 && (
                                                        <ArrowRight size={14} className="text-muted" />
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                                attribution='&copy; Google Maps'
                            />

                            <FitBounds routes={routes} />

                            {/* Start Marker */}
                            {request.start && (
                                <Marker position={[request.start.lat, request.start.lon]} icon={GreenPin}>
                                    <Popup>Start: {request.start.name}</Popup>
                                </Marker>
                            )}

                            {/* End Marker */}
                            {request.end && (
                                <Marker position={[request.end.lat, request.end.lon]} icon={RedPin}>
                                    <Popup>End: {request.end.name}</Popup>
                                </Marker>
                            )}

                            {/* DRAW DYNAMIC NUMBERED STOPS ON MAP */}
                            {request.stops.map((s, i) => {
                                if (s.location) {
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

                            {/* Polylines (Routes) */}
                            {routes.map((route, index) => {
                                const positions = (route.route_sequence || []).map((p) => [
                                    parseFloat(p.lat),
                                    parseFloat(p.lon),
                                ]);
                                if (positions.length === 0) return null;

                                const isOptimal = route.mode?.includes("Recommended");
                                const selected = isSameRoute(selectedRoute, route);

                                // Visual Styling Logic
                                const dimOthers = !!selectedRoute;
                                const opacity = !dimOthers ? (isOptimal ? 0.95 : 0.75) : (selected ? 0.95 : 0.25);
                                const weight = selected ? (isOptimal ? 9 : 7) : (isOptimal ? 8 : 6);
                                const color = isOptimal ? "#0d6efd" : "#343a40";

                                return (
                                    <Polyline
                                        key={index}
                                        positions={positions}
                                        pathOptions={{
                                            color,
                                            weight,
                                            opacity,
                                            dashArray: isOptimal ? null : "8 10",
                                        }}
                                        eventHandlers={{
                                            click: () => setSelectedRoute(route),
                                        }}
                                    >
                                        <Popup>
                                            <strong>{route.mode}</strong><br />
                                            Time: {(route.time_seconds / 60).toFixed(0)} min<br />
                                            CO2: {route.co2_emissions.toFixed(2)} kg
                                        </Popup>
                                    </Polyline>
                                );
                            })}

                            {/* TRUCK ANIMATOR (PRESERVED) */}
                            {selectedRoute && (
                                <RouteAnimator
                                    key={`${selectedRoute.mode}-${selectedRoute.time_seconds}`}
                                    routeCoordinates={selectedRoute.route_sequence.map(p => [
                                        parseFloat(p.lat),
                                        parseFloat(p.lon)
                                    ])}
                                    isPlaying={isAnimating}
                                    onAnimationEnd={() => setIsAnimating(false)}
                                />
                            )}

                            <RouteLegend />
                        </MapContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouteBuilder;