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
import LocationPicker from "./LocationPicker";
import api from "../axiosInstance.js";
import AuthService from "../authentication/AuthService.js";
import {Link} from "react-router-dom";
import * as XLSX from "xlsx";
import { GreenPin, RedPin, createNumberIcon } from "./MapIcons.js";
import {
    Calendar, Package, MapPin, X,
    Mail, CheckCircle2, Loader2, Send,
    ClipboardList, ArrowRight, Plus, Download, LogOut
} from "lucide-react";


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
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [optimizingId, setOptimizingId] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());

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
        if (!form.tripName || !form.tripName.trim()) {
            alert("Please enter a Trip Name.");
            return;
        }
        if (form.tripName.trim().length < 3) {
            alert("Trip Name must be at least 3 characters.");
            return;
        }
        if (!form.start) {
            alert("Please select a Start location.");
            return;
        }
        if (!form.end) {
            alert("Please select an End location.");
            return;
        }
        if (form.start.lat === form.end.lat && form.start.lon === form.end.lon) {
            alert("Start and End locations cannot be the same.");
            return;
        }
        if (!form.departureDate) {
            alert("Please select a Departure Date.");
            return;
        }
        if (!form.departureTime) {
            alert("Please select a Departure Time.");
            return;
        }

        const departure = new Date(`${form.departureDate}T${form.departureTime}`);
        if (departure < new Date()) {
            alert("Departure date and time cannot be in the past.");
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

    const normalizeStop = (s, idx) => {
        const lat = parseFloat(s?.lat ?? s?.latitude);
        const lon = parseFloat(s?.lon ?? s?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        return {
            id: s?.id ?? `saved-stop-${idx}`,
            name: s?.name ?? `Stop ${idx + 1}`,
            lat,
            lon,
        };
    };

    const handleOptimize = async (schedule) => {
        try {
            setOptimizingId(schedule.id);

            const [scheduleRes, optimizeRes] = await Promise.all([
                api.get(`/api/schedules/${schedule.id}`),
                api.post(`/api/schedules/${schedule.id}/optimize`),
            ]);

            const fullSchedule = scheduleRes.data;
            const routes = optimizeRes.data || [];

            setSelectedSchedule(fullSchedule);
            setOptimizedRoutes(routes);
            setSelectedRoute(routes.length > 0 ? routes[0] : null);
            setSelectedScheduleMeta(schedule);
            setMessage("Scheduled trip optimized successfully.");
        } catch (e) {
            console.error(e);
            setMessage("Optimization failed.");
            setOptimizedRoutes([]);
            setSelectedRoute(null);
            setSelectedScheduleMeta(null);
            setSelectedSchedule(null);
        } finally {
            setOptimizingId(null);
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

    const formatTime = (seconds) => {
        const totalMinutes = Math.round(seconds / 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const handleEmailSend = async () => {
        if (!driverEmail.includes("@")) {
            alert("Please enter a valid email address.");
            return;
        }

        setIsSendingEmail(true);

        const stopsList = selectedRoute.stop_order
            ? selectedRoute.stop_order.join(" → ")
            : "Direct Route";
        const timeMins = formatTime(selectedRoute.time_seconds);

        const mapsUrl = routeStartPosition && routeEndPosition
            ? `https://www.google.com/maps/dir/?api=1&origin=${routeStartPosition[0]},${routeStartPosition[1]}&destination=${routeEndPosition[0]},${routeEndPosition[1]}&travelmode=driving`
            : "";

        const payload = {
            driverEmail:   driverEmail,
            tripName:      selectedScheduleMeta?.tripName || "Scheduled Trip",
            mode:          selectedRoute.mode,
            time:          timeMins.toString(),
            stops:         stopsList,
            googleMapsUrl: mapsUrl,
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
            alert("Failed to send email.");
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

    const mapStops = selectedSchedule
        ? (selectedSchedule.stops || []).map(normalizeStop).filter(Boolean)
        : form.stops
            .filter((s) => s.location)
            .map((s) => ({
                id: s.id,
                name: s.location.name,
                lat: s.location.lat,
                lon: s.location.lon,
            }));

    const mapStartPosition =
        selectedSchedule &&
        Number.isFinite(parseFloat(selectedSchedule.startLat)) &&
        Number.isFinite(parseFloat(selectedSchedule.startLon))
            ? [parseFloat(selectedSchedule.startLat), parseFloat(selectedSchedule.startLon)]
            : routeStartPosition;

    const mapEndPosition =
        selectedSchedule &&
        Number.isFinite(parseFloat(selectedSchedule.endLat)) &&
        Number.isFinite(parseFloat(selectedSchedule.endLon))
            ? [parseFloat(selectedSchedule.endLat), parseFloat(selectedSchedule.endLon)]
            : routeEndPosition;

    const lastStopName = selectedRoute?.stop_order?.at(-1);

    const handleExportSelected = async () => {
        if (selectedIds.size === 0) return;

        const headers = [
            "tripName","startName","startLat","startLon",
            "endName","endLat","endLon",
            "departureDate","departureTime","vehicleType","weightKg",
            "stop1Name","stop1Lat","stop1Lon",
            "stop2Name","stop2Lat","stop2Lon",
        ];

        const rows = [];
        for (const id of selectedIds) {
            try {
                const res  = await api.get(`/api/schedules/${id}`);
                const t    = res.data;
                const dt   = new Date(t.departureTime);
                const date = dt.toISOString().split("T")[0];
                const time = dt.toTimeString().slice(0, 5);

                const stops = t.stops || [];
                rows.push([
                    t.tripName,
                    t.startName, t.startLat, t.startLon,
                    t.endName,   t.endLat,   t.endLon,
                    date, time,
                    t.vehicleType, t.weightKg,
                    stops[0]?.name || "", stops[0]?.lat || "", stops[0]?.lon || "",
                    stops[1]?.name || "", stops[1]?.lat || "", stops[1]?.lon || "",
                ]);
            } catch (e) {
                console.error(`Failed to fetch schedule ${id}`, e);
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.aoa_to_sheet([headers, ...rows]),
            "Schedules"
        );
        XLSX.writeFile(wb, "selected_schedules.xlsx");
        setSelectedIds(new Set());
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === schedules.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(schedules.map((s) => s.id)));
        }
    };

    return (
        <div className="container-fluid py-4">

            {showEmailModal && (
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
                            <button className="btn btn-sm btn-dark d-flex align-items-center"
                                    onClick={() => setShowEmailModal(false)} disabled={isSendingEmail}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="card-body p-4 text-center">
                            {emailSuccess ? (
                                <div className="py-3">
                                    <CheckCircle2 size={48} className="text-success mb-2" />
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
                                        className="btn btn-primary w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                                        onClick={handleEmailSend}
                                        disabled={isSendingEmail || !driverEmail}
                                    >
                                        {isSendingEmail ? (
                                            <><Loader2 size={14} className="spin" /> Dispatching...</>
                                        ) : (
                                            <><Send size={14} /> Send Route Details</>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {pickerState.isOpen && (
                <LocationPicker
                    onClose={() => setPickerState({ isOpen: false, activeField: null })}
                    onConfirm={handleLocationPicked}
                />
            )}

            <div className="row g-4">
                <div className="col-lg-4">
                    <div className="card p-3 mb-4">
                        <h3 className="mb-3 d-flex align-items-center gap-2">
                            <Calendar size={20} className="text-primary" /> Scheduled Trip Planning
                        </h3>

                        <div className="d-flex justify-content-between mb-3">
                            <Link to="/dashboard" className="btn btn-sm btn-outline-primary">Route Builder</Link>
                            <Link to="/bulk-schedule" className="btn btn-sm btn-outline-success d-flex align-items-center gap-1">
                                <Package size={14} /> Bulk Schedule
                            </Link>
                            <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => { AuthService.logout(); window.location.href = "/login"; }}
                            >
                                <LogOut size={14} /> Logout
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
                                <button className="btn btn-outline-success d-flex align-items-center" onClick={() => openPicker("start")}>
                                    <MapPin size={15} className="text-success" />
                                </button>
                            </div>
                        </div>

                        <div className="mb-2">
                            <label>End</label>
                            <div className="input-group">
                                <input className="form-control" readOnly value={form.end?.name || ""} />
                                <button className="btn btn-danger d-flex align-items-center"
                                        onClick={() => openPicker("end")}>
                                    <MapPin size={15} />
                                </button>
                            </div>
                        </div>

                        <div className="mb-2">
                            <div className="d-flex justify-content-between">
                                <label>Stops</label>
                                <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                        onClick={addStop}>
                                    <Plus size={13} /> Add
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
                                    <button className="btn btn-outline-secondary d-flex align-items-center"
                                            onClick={() => openPicker(`stop-${s.id}`)}>
                                        <MapPin size={15} />
                                    </button>
                                    <button className="btn btn-danger d-flex align-items-center"
                                            onClick={() => removeStop(s.id)}>
                                        <X size={13} />
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
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5 className="mb-0">Saved Schedules</h5>
                            <div className="d-flex gap-2 align-items-center">
                                {schedules.length > 0 && (
                                    <label className="d-flex align-items-center gap-1 small text-muted mb-0"
                                           style={{ cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === schedules.length && schedules.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                        All
                                    </label>
                                )}
                                <button
                                    className="btn btn-sm btn-success"
                                    onClick={handleExportSelected}
                                    disabled={selectedIds.size === 0}
                                    title="Export selected as Excel bulk template"
                                >
                                    <Download size={13} /> Export ({selectedIds.size})
                                </button>
                                <Link to="/bulk-schedule" className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1">
                                    <Package size={13} /> Bulk Schedule
                                </Link>
                            </div>
                        </div>

                        {schedules.map((s) => (
                            <div
                                key={s.id}
                                className="border rounded p-2 mb-2 d-flex justify-content-between align-items-center"
                                style={{
                                    background: selectedIds.has(s.id) ? "#f0f7ff" : "white",
                                    borderColor: selectedIds.has(s.id) ? "#0d6efd" : undefined,
                                    transition: "background 0.15s",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2 flex-shrink-0"
                                    checked={selectedIds.has(s.id)}
                                    onChange={() => toggleSelect(s.id)}
                                    style={{ cursor: "pointer", marginTop: 0 }}
                                />

                                <div className="flex-grow-1" style={{ cursor: "pointer" }}
                                     onClick={() => toggleSelect(s.id)}>
                                    <strong>{s.tripName || `Trip #${s.id}`}</strong>
                                    <br />
                                    <small className="text-muted">
                                        {new Date(s.departureTime).toLocaleString()} | {s.status}
                                    </small>
                                </div>

                                <button
                                    className="btn btn-warning btn-sm flex-shrink-0 d-flex align-items-center gap-1"
                                    onClick={(e) => { e.stopPropagation(); handleOptimize(s); }}
                                    disabled={optimizingId === s.id}
                                >
                                    {optimizingId === s.id ? (
                                        <><span className="spinner-border spinner-border-sm" /> Optimizing...</>
                                    ) : "Optimize"}
                                </button>
                            </div>
                        ))}

                        {schedules.length === 0 && (
                            <p className="text-muted small mb-0">No saved schedules yet.</p>
                        )}
                    </div>

                    {selectedRoute && (
                        <div className="card border-0 shadow-lg mt-4" style={{ borderRadius: "15px", overflow: "hidden" }}>
                            <div className="card-header bg-primary text-white p-3 border-0 d-flex justify-content-between align-items-center">
                                <span className="fw-bold mb-0 d-flex align-items-center gap-2">
                                    <ClipboardList size={16} /> Optimized Route Ready </span>
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

                                <button className="btn btn-success w-100 py-2 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                                        onClick={() => setShowEmailModal(true)}>
                                    <Mail size={15} /> Email to Driver
                                </button>
                            </div>
                        </div>
                    )}
                </div>

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

                            {mapStartPosition && (
                                <Marker position={mapStartPosition} icon={GreenPin}>
                                    <Popup>
                                        Start: {selectedSchedule?.startName || selectedRoute?.stop_order?.[0] || "Start"}
                                    </Popup>
                                </Marker>
                            )}

                            {mapEndPosition && (
                                <Marker position={mapEndPosition} icon={RedPin}>
                                    <Popup>
                                        End: {selectedSchedule?.endName || lastStopName || "End"}
                                    </Popup>
                                </Marker>
                            )}

                            {mapStops.map((s, i) => {
                                let displayNum = i + 1;

                                if (selectedRoute?.stop_order) {
                                    const optIndex = selectedRoute.stop_order.indexOf(s.name);
                                    if (optIndex > 0 && optIndex < selectedRoute.stop_order.length - 1) {
                                        displayNum = optIndex;
                                    }
                                }

                                return (
                                    <Marker
                                        key={s.id}
                                        position={[s.lat, s.lon]}
                                        icon={createNumberIcon(displayNum)}
                                    >
                                        <Popup><b>Stop {displayNum}</b>: {s.name}</Popup>
                                    </Marker>
                                );
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