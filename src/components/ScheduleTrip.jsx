import React, { useState, useEffect } from "react";
import axios from "axios";
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

    useEffect(() => {
        loadSchedules();
    }, []);

    const loadSchedules = async () => {
        try {
            const res = await axios.get("http://localhost:8080/api/schedules");
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
            await axios.post("http://localhost:8080/api/schedules", payload);
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

            const res = await axios.post(
                `http://localhost:8080/api/schedules/${schedule.id}/optimize`
            );

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

    return (
        <div className="container-fluid py-4">
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
                                        {s.departureTime} | {s.status}
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

                    {selectedRoute && (
                        <div className="card shadow-sm border-primary">
                            <div className="card-header bg-primary text-white fw-bold">
                                📋 Scheduled Route Details
                            </div>
                            <div className="card-body">
                                {selectedScheduleMeta && (
                                    <p className="small text-muted mb-2">
                                        <strong>{selectedScheduleMeta.tripName || "Scheduled Trip"}</strong>
                                        <br />
                                        {selectedScheduleMeta.departureTime}
                                    </p>
                                )}

                                <h5 className="card-title">{selectedRoute.mode}</h5>
                                <p className="card-text small text-muted">
                                    {selectedRoute.explanation}
                                </p>
                                <hr />

                                <div className="d-flex justify-content-between text-center mb-3">
                                    <div>
                                        <small className="text-muted">Time</small>
                                        <br />
                                        <strong>
                                            {(selectedRoute.time_seconds / 60).toFixed(0)} min
                                        </strong>
                                    </div>
                                    <div>
                                        <small className="text-muted">CO2</small>
                                        <br />
                                        <strong>
                                            {selectedRoute.co2_emissions.toFixed(2)} kg
                                        </strong>
                                    </div>
                                    <div>
                                        <small className="text-muted">Cost</small>
                                        <br />
                                        <strong>
                                            Rs. {selectedRoute.cost_currency.toFixed(0)}
                                        </strong>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <small className="text-muted">Predicted Traffic Factor</small>
                                    <br />
                                    <strong>
                                        {selectedRoute.avg_traffic_factor
                                            ? `${Number(selectedRoute.avg_traffic_factor).toFixed(2)}x`
                                            : "N/A"}
                                    </strong>
                                </div>

                                {selectedRoute.stop_order?.length > 0 && (
                                    <div>
                                        <small className="text-muted">Stop Order</small>
                                        <div className="mt-1">
                                            {selectedRoute.stop_order.join(" → ")}
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
                        className="card"
                        style={{ height: "80vh", overflow: "hidden", position: "relative" }}
                    >
                        <MapContainer
                            center={[6.9271, 79.8612]}
                            zoom={8}
                            style={{ height: "100%", width: "100%" }}
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