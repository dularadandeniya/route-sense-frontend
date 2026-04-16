import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
    MapContainer, TileLayer, Polyline,
    Marker, Popup, useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../axiosInstance";
import { Link } from "react-router-dom";
import AuthService from "../authentication/AuthService";
import { Download, Upload, FileSpreadsheet, Plus, Rocket, Zap,
    Tag, Clock, Ruler, Leaf, Banknote, LogOut, XCircle, CheckCircle,
    Send, Package, Map, BarChart2, X } from "lucide-react";

// ── Color palette — one per trip ──────────────────────────
const TRIP_COLORS = [
    "#e74c3c","#2ecc71","#9b59b6","#f39c12",
    "#1abc9c","#e67e22","#3498db","#e91e63",
    "#00bcd4","#ff5722",
];

const VEHICLE_TYPES = ["SMALL", "MEDIUM", "LARGE", "TRUCK"];

const emptyRow = () => ({
    tripName: "", startName: "", startLat: "", startLon: "",
    endName: "", endLat: "", endLon: "",
    departureDate: "", departureTime: "",
    vehicleType: "MEDIUM", weightKg: 50,
    stop1Name: "", stop1Lat: "", stop1Lon: "",
    stop2Name: "", stop2Lat: "", stop2Lon: "",
});

// ── Leaflet icon helpers ──────────────────────────────────
const createColorIcon = (hexColor) =>
    L.divIcon({
        className: "",
        html: `<div style="
            width:14px;height:14px;border-radius:50%;
            background:${hexColor};border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.4);">
        </div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });

// ── FitBounds: fits map to all rendered routes ────────────
const FitAllBounds = ({ allRoutes }) => {
    const map = useMap();
    React.useEffect(() => {
        const allPoints = allRoutes.flatMap(({ route }) =>
            (route?.route_sequence || []).map((p) => [parseFloat(p.lat), parseFloat(p.lon)])
        );
        if (allPoints.length > 0) {
            map.fitBounds(allPoints, { padding: [40, 40] });
        }
    }, [allRoutes, map]);
    return null;
};

// ── Format seconds → "Xh Ym" ─────────────────────────────
const fmtTime = (s) => {
    const m = Math.round(s / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

const fmtDist = (meters) => {
    const num = parseFloat(meters);
    if (!meters || isNaN(num) || !isFinite(num) || num <= 0) return "N/A";
    return (num / 1000).toFixed(2) + " km";
};

// ── Helper: Build Google Maps URL ─────────────────────────
const buildMapsUrl = (row) => {
    if (!row) return "";
    const origin = `${row.startLat},${row.startLon}`;
    const dest   = `${row.endLat},${row.endLon}`;
    const waypts = [];
    if (row.stop1Lat && row.stop1Lon) waypts.push(`${row.stop1Lat},${row.stop1Lon}`);
    if (row.stop2Lat && row.stop2Lon) waypts.push(`${row.stop2Lat},${row.stop2Lon}`);
    const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    return waypts.length > 0 ? `${base}&waypoints=${waypts.join("|")}` : base;
};

// ── Helper: Build Stops Text for Email ────────────────────
const buildStopsText = (row) => {
    let txt = `1. ${row.startName || "Start"} (${row.startLat}, ${row.startLon})\n`;
    let seq = 2;
    if (row.stop1Name && row.stop1Lat) txt += `${seq++}. ${row.stop1Name} (${row.stop1Lat}, ${row.stop1Lon})\n`;
    if (row.stop2Name && row.stop2Lat) txt += `${seq++}. ${row.stop2Name} (${row.stop2Lat}, ${row.stop2Lon})\n`;
    txt += `${seq}. ${row.endName || "End"} (${row.endLat}, ${row.endLon})`;
    return txt;
};

// ═════════════════════════════════════════════════════════
export default function BulkSchedule() {
    const [rows, setRows]               = useState([emptyRow()]);
    const [message, setMessage]         = useState("");
    const [loading, setLoading]         = useState(false);

    // Email states
    const [emailInputs, setEmailInputs]   = useState({});  // { tripName: emailString }
    const [emailSending, setEmailSending] = useState({});  // { tripName: bool }
    const [emailSent, setEmailSent]       = useState({});  // { tripName: bool }

    // After bulk submit: [{id, tripName, color}]
    const [createdTrips, setCreatedTrips] = useState([]);

    // After optimize all: [{tripName, color, route, meta, rowData}]
    const [optimizedResults, setOptimizedResults] = useState([]);

    // Which trip is highlighted on map
    const [highlighted, setHighlighted] = useState(null);

    // Optimize-all progress
    const [optimProgress, setOptimProgress] = useState({ current: 0, total: 0 });

    // ── Table helpers ───────────────────────────────────
    const updateRow = (i, field, value) =>
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
    const addRow    = () => setRows((prev) => [...prev, emptyRow()]);
    const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

    // ── Download blank template ─────────────────────────
    const downloadTemplate = () => {
        const headers = [
            "tripName","startName","startLat","startLon",
            "endName","endLat","endLon",
            "departureDate","departureTime","vehicleType","weightKg",
            "stop1Name","stop1Lat","stop1Lon",
            "stop2Name","stop2Lat","stop2Lon",
        ];
        const example = [
            "Trip A","Colombo",6.9271,79.8612,
            "Kandy",7.2906,80.6337,
            "2026-04-15","08:00","MEDIUM",100,
            "Kadawatha",7.0013,79.9507,"","",""
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, example]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trips");
        XLSX.writeFile(wb, "bulk_trip_template.xlsx");
    };

    // ── Export current rows to Excel ─────────────────────
    const exportToExcel = () => {
        const headers = Object.keys(emptyRow());
        const data = rows.map((r) => headers.map((h) => r[h]));
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trips");
        XLSX.writeFile(wb, "bulk_trips.xlsx");
    };

    // ── Upload Excel → populate table ────────────────────
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
            const parsed = data.map((r) => ({
                tripName: String(r.tripName || ""),
                startName: String(r.startName || ""),
                startLat: r.startLat || "",
                startLon: r.startLon || "",
                endName: String(r.endName || ""),
                endLat: r.endLat || "",
                endLon: r.endLon || "",
                departureDate: String(r.departureDate || ""),
                departureTime: String(r.departureTime || ""),
                vehicleType: String(r.vehicleType || "MEDIUM"),
                weightKg: r.weightKg || 50,
                stop1Name: String(r.stop1Name || ""),
                stop1Lat: r.stop1Lat || "",
                stop1Lon: r.stop1Lon || "",
                stop2Name: String(r.stop2Name || ""),
                stop2Lat: r.stop2Lat || "",
                stop2Lon: r.stop2Lon || "",
            }));
            setRows(parsed);
            setCreatedTrips([]);
            setOptimizedResults([]);
            setMessage(`Loaded ${parsed.length} trip(s) from Excel.`);
        };
        reader.readAsBinaryString(file);
        // reset so same file can be re-uploaded
        e.target.value = "";
    };

    // ── Submit all rows → POST /api/schedules/bulk ───────
    const handleSubmitAll = async () => {
        setLoading(true);
        setMessage("");
        setCreatedTrips([]);
        setOptimizedResults([]);

        const validRows = rows.filter((r) => r.tripName && r.startLat && r.endLat);
        if (validRows.length === 0) {
            setMessage(" No valid rows to submit. Fill in at least Trip Name, Start, and End.");
            setLoading(false);
            return;
        }

        const payload = validRows.map((r) => {
            const stops = [];
            if (r.stop1Name && r.stop1Lat && r.stop1Lon)
                stops.push({ name: r.stop1Name, latitude: parseFloat(r.stop1Lat), longitude: parseFloat(r.stop1Lon) });
            if (r.stop2Name && r.stop2Lat && r.stop2Lon)
                stops.push({ name: r.stop2Name, latitude: parseFloat(r.stop2Lat), longitude: parseFloat(r.stop2Lon) });
            return {
                tripName: r.tripName,
                startName: r.startName,
                startLat: parseFloat(r.startLat),
                startLon: parseFloat(r.startLon),
                endName: r.endName,
                endLat: parseFloat(r.endLat),
                endLon: parseFloat(r.endLon),
                departureTime: `${r.departureDate}T${r.departureTime}:00`,
                vehicleType: r.vehicleType,
                weightKg: parseFloat(r.weightKg),
                stops,
            };
        });

        try {
            const res = await api.post("/api/schedules/bulk", payload);
            const created = res.data.map((t, i) => ({
                id: t.id,
                tripName: t.tripName,
                color: TRIP_COLORS[i % TRIP_COLORS.length],
            }));
            setCreatedTrips(created);
            setMessage(`${created.length} trip(s) scheduled! Now click "Optimize All" to run optimization.`);
        } catch (e) {
            console.error(e);
            setMessage("Failed to submit trips. Check console.");
        } finally {
            setLoading(false);
        }
    };

    // ── Optimize All ─────────────────────────────────────
    const handleOptimizeAll = async () => {
        if (createdTrips.length === 0) return;
        setOptimizedResults([]);
        setOptimProgress({ current: 0, total: createdTrips.length });
        setMessage("");

        const results = [];
        for (let i = 0; i < createdTrips.length; i++) {
            const trip = createdTrips[i];
            setOptimProgress({ current: i + 1, total: createdTrips.length });
            try {
                const res = await api.post(`/api/schedules/${trip.id}/optimize`);
                const routes = res.data || [];
                // Pick the Recommended route, else first
                const best = routes.find((r) => r.mode?.includes("Recommended")) || routes[0];
                if (best) {
                    results.push({
                        tripName: trip.tripName,
                        color: trip.color,
                        route: best,
                        allRoutes: routes,
                        rowData: rows[i],
                    });
                }
            } catch (e) {
                console.error(`Failed to optimize trip ${trip.tripName}`, e);
                results.push({
                    tripName: trip.tripName,
                    color: trip.color,
                    route: null,
                    allRoutes: [],
                    rowData: rows[i]
                });
            }
        }

        setOptimizedResults(results);
        setOptimProgress({ current: 0, total: 0 });
        setMessage(`Optimization complete for ${results.filter(r => r.route).length} trip(s).`);
    };

    // ── Email Sending Logic ──────────────────────────────
    const handleSendEmail = async (result) => {
        const email = emailInputs[result.tripName];
        if (!email || !email.includes("@")) {
            alert("Please enter a valid email address.");
            return;
        }
        setEmailSending((prev) => ({ ...prev, [result.tripName]: true }));
        try {
            const mapsUrl   = buildMapsUrl(result.rowData);
            const stopsText = buildStopsText(result.rowData);
            await api.post("/api/email/send-route", {
                driverEmail:   email,
                tripName:      result.tripName,
                mode:          result.route.mode,
                time:          fmtTime(result.route.time_seconds),
                stops:         stopsText,
                googleMapsUrl: mapsUrl,
            });
            setEmailSent((prev) => ({ ...prev, [result.tripName]: true }));
        } catch (e) {
            console.error("Email send failed:", e);
            alert("Failed to send email. Check console.");
        } finally {
            setEmailSending((prev) => ({ ...prev, [result.tripName]: false }));
        }
    };

    // ── Export optimized results to Excel ─────────────────
    const exportResults = () => {
        const headers = ["Trip Name","Mode","Time","Distance (km)","CO2 (kg)","Cost (LKR)"];
        const data = optimizedResults
            .filter((r) => r.route)
            .map((r) => [
                r.tripName,
                r.route.mode,
                fmtTime(r.route.time_seconds),
                (r.route.distance_meters / 1000).toFixed(2),
                r.route.co2_emissions?.toFixed(3) ?? "N/A",
                r.route.cost?.toFixed(2) ?? "N/A",
            ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Optimized Results");
        XLSX.writeFile(wb, "optimized_results.xlsx");
    };

    const successResults = optimizedResults.filter((r) => r.route);

    // ── Render ────────────────────────────────────────────
    return (
        <div className="container-fluid py-4">

            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h3 className="mb-0 d-flex align-items-center gap-2">
                    <Package size={22} className="text-warning" /> Bulk Trip Scheduling
                </h3>
                <div className="d-flex gap-2">
                    <Link to="/schedules" className="btn btn-sm btn-outline-primary">Single Schedule</Link>
                    <Link to="/dashboard" className="btn btn-sm btn-outline-secondary">Route Builder</Link>
                    <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => { AuthService.logout(); window.location.href = "/login"; }}
                    >
                        <LogOut size={14} /> Logout
                    </button>
                </div>
            </div>

            {/* Action toolbar */}
            <div className="d-flex gap-2 mb-3 flex-wrap">
                <button
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    onClick={downloadTemplate}
                >
                    <Download size={14} /> Download Template
                </button>
                <button
                    className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                    onClick={exportToExcel}
                >
                    <Upload size={14} /> Export Table
                </button>
                <label className="btn btn-outline-success btn-sm mb-0 d-flex align-items-center gap-1"
                       style={{ cursor: "pointer" }}>
                    <FileSpreadsheet size={14} /> Upload Excel
                    <input type="file" accept=".xlsx,.xls" hidden onChange={handleFileUpload} />
                </label>
                <button
                    className="btn btn-sm btn-outline-dark ms-auto d-flex align-items-center gap-1"
                    onClick={addRow}
                >
                    <Plus size={14} /> Add Row
                </button>
            </div>

            {message && (
                <div className="alert alert-info py-2 mb-3">{message}</div>
            )}

            {/* Progress bar while optimizing */}
            {optimProgress.total > 0 && (
                <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                        <small>Optimizing trip {optimProgress.current} of {optimProgress.total}...</small>
                        <small>{Math.round((optimProgress.current / optimProgress.total) * 100)}%</small>
                    </div>
                    <div className="progress">
                        <div
                            className="progress-bar progress-bar-striped progress-bar-animated"
                            style={{ width: `${(optimProgress.current / optimProgress.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ── Input Table ── */}
            <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
                <table className="table table-bordered table-sm" style={{ minWidth: 1500 }}>
                    <thead className="table-dark">
                    <tr>
                        <th>#</th>
                        <th>Trip Name</th>
                        <th>Start Name</th><th>Start Lat</th><th>Start Lon</th>
                        <th>End Name</th><th>End Lat</th><th>End Lon</th>
                        <th>Date</th><th>Time</th>
                        <th>Vehicle</th><th>Weight(kg)</th>
                        <th>Stop1 Name</th><th>S1 Lat</th><th>S1 Lon</th>
                        <th>Stop2 Name</th><th>S2 Lat</th><th>S2 Lon</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            <td className="text-center align-middle">
                                {createdTrips.length > 0 && createdTrips[i] ? (
                                    <span
                                        style={{
                                            display: "inline-block",
                                            width: 14, height: 14,
                                            borderRadius: "50%",
                                            background: createdTrips[i]?.color || "#ccc",
                                            border: "2px solid #fff",
                                            boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
                                        }}
                                        title={createdTrips[i]?.color}
                                    />
                                ) : (
                                    <span className="text-muted">{i + 1}</span>
                                )}
                            </td>
                            {["tripName","startName","startLat","startLon","endName","endLat","endLon"].map((f) => (
                                <td key={f}>
                                    <input
                                        className="form-control form-control-sm"
                                        style={{ minWidth: f.includes("Name") ? 110 : 80 }}
                                        type={f.includes("Lat") || f.includes("Lon") ? "number" : "text"}
                                        value={r[f]}
                                        onChange={(e) => updateRow(i, f, e.target.value)}
                                    />
                                </td>
                            ))}
                            <td>
                                <input
                                    type="date" className="form-control form-control-sm"
                                    style={{ minWidth: 130 }}
                                    value={r.departureDate}
                                    onChange={(e) => updateRow(i, "departureDate", e.target.value)}
                                />
                            </td>
                            <td>
                                <input
                                    type="time" className="form-control form-control-sm"
                                    style={{ minWidth: 100 }}
                                    value={r.departureTime}
                                    onChange={(e) => updateRow(i, "departureTime", e.target.value)}
                                />
                            </td>
                            <td>
                                <select
                                    className="form-select form-select-sm"
                                    style={{ minWidth: 90 }}
                                    value={r.vehicleType}
                                    onChange={(e) => updateRow(i, "vehicleType", e.target.value)}
                                >
                                    {VEHICLE_TYPES.map((v) => <option key={v}>{v}</option>)}
                                </select>
                            </td>
                            <td>
                                <input
                                    type="number" className="form-control form-control-sm"
                                    style={{ minWidth: 70 }}
                                    value={r.weightKg}
                                    onChange={(e) => updateRow(i, "weightKg", e.target.value)}
                                />
                            </td>
                            {["stop1Name","stop1Lat","stop1Lon","stop2Name","stop2Lat","stop2Lon"].map((f) => (
                                <td key={f}>
                                    <input
                                        className="form-control form-control-sm"
                                        style={{ minWidth: f.includes("Name") ? 100 : 75 }}
                                        type={f.includes("Lat") || f.includes("Lon") ? "number" : "text"}
                                        value={r[f]}
                                        onChange={(e) => updateRow(i, f, e.target.value)}
                                    />
                                </td>
                            ))}
                            <td className="text-center align-middle">
                                <button className="btn btn-sm btn-danger d-flex align-items-center" onClick={() => removeRow(i)}>
                                    <X size={13} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Submit + Optimize buttons */}
            <div className="d-flex justify-content-end gap-2 mb-4">
                <button
                    className="btn btn-primary d-flex align-items-center gap-2"
                    onClick={handleSubmitAll}
                    disabled={loading}
                >
                    {loading ? (
                        <><span className="spinner-border spinner-border-sm" /> Submitting...</>
                    ) : (
                        <><Rocket size={15} /> Submit All Trips</>
                    )}
                </button>
                <button
                    className="btn btn-success d-flex align-items-center gap-2"
                    onClick={handleOptimizeAll}
                    disabled={createdTrips.length === 0 || optimProgress.total > 0}
                >
                    {optimProgress.total > 0 ? (
                        <><span className="spinner-border spinner-border-sm" /> Optimizing...</>
                    ) : (
                        <><Zap size={15} /> Optimize All ({createdTrips.length})</>
                    )}
                </button>
            </div>

            {/* ── Map + Results ── */}
            {successResults.length > 0 && (
                <div className="row g-4">

                    {/* Map */}
                    <div className="col-lg-8">
                        <div className="card p-0 overflow-hidden">
                            <div className="card-header d-flex justify-content-between align-items-center">
                                <strong className="d-flex align-items-center gap-2">
                                    <Map size={16} /> Optimized Routes — All Trips
                                </strong>
                                <small className="text-muted">Click a route to highlight</small>
                            </div>
                            <MapContainer
                                center={[7.8731, 80.7718]}
                                zoom={8}
                                style={{ height: 520, width: "100%" }}
                            >
                                <TileLayer
                                    url="http://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                                    attribution="&copy; Google Maps"
                                />
                                <FitAllBounds allRoutes={successResults} />

                                {successResults.map(({ tripName, color, route }) => {
                                    if (!route?.route_sequence?.length) return null;
                                    const positions = route.route_sequence.map((p) => [
                                        parseFloat(p.lat), parseFloat(p.lon),
                                    ]);
                                    const isHl = highlighted === tripName;
                                    const dimmed = highlighted && !isHl;

                                    return (
                                        <React.Fragment key={tripName}>
                                            {/* Route polyline */}
                                            <Polyline
                                                positions={positions}
                                                pathOptions={{
                                                    color,
                                                    weight: isHl ? 7 : 4,
                                                    opacity: dimmed ? 0.25 : 0.9,
                                                }}
                                                eventHandlers={{
                                                    click: () =>
                                                        setHighlighted((prev) =>
                                                            prev === tripName ? null : tripName
                                                        ),
                                                }}
                                            >
                                                <Popup>
                                                    <strong style={{ color }}>{tripName}</strong><br />
                                                    {route.mode}<br />
                                                    Time: {fmtTime(route.time_seconds)}<br />
                                                    CO₂: {route.co2_emissions?.toFixed(3)} kg
                                                </Popup>
                                            </Polyline>

                                            {/* Start marker */}
                                            <Marker position={positions[0]} icon={createColorIcon(color)}>
                                                <Popup><strong>{tripName}</strong><br />Start</Popup>
                                            </Marker>

                                            {/* End marker */}
                                            <Marker position={positions[positions.length - 1]} icon={createColorIcon(color)}>
                                                <Popup><strong>{tripName}</strong><br /> End</Popup>
                                            </Marker>
                                        </React.Fragment>
                                    );
                                })}
                            </MapContainer>
                        </div>
                    </div>

                    {/* Results sidebar */}
                    <div className="col-lg-4">
                        <div className="card h-100">
                            <div className="card-header d-flex justify-content-between align-items-center">
                                <strong className="d-flex align-items-center gap-2">
                                    <BarChart2 size={16} /> Results Summary
                                </strong>
                                <button className="btn btn-sm btn-outline-success d-flex align-items-center gap-1" onClick={exportResults}>
                                    <Download size={13} /> Export
                                </button>
                            </div>
                            <div className="card-body p-0" style={{ overflowY: "auto", maxHeight: 500 }}>
                                {optimizedResults.map(({ tripName, color, route, rowData }) => (
                                    <div
                                        key={tripName}
                                        className="p-3 border-bottom"
                                        style={{
                                            cursor: "pointer",
                                            background: highlighted === tripName ? "#f0f4ff" : "white",
                                            borderLeft: `5px solid ${color}`,
                                        }}
                                        onClick={() => setHighlighted((prev) => prev === tripName ? null : tripName)}
                                    >
                                        {/* Trip name + color dot */}
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <span style={{ width:12, height:12, borderRadius:"50%", background:color, display:"inline-block", flexShrink:0 }} />
                                            <strong style={{ fontSize:14 }}>{tripName}</strong>
                                        </div>

                                        {route ? (
                                            <>
                                                {/* Route stats */}
                                                <div style={{ fontSize: 13, paddingLeft: 20, marginBottom: 8, lineHeight: 1.8 }}>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <Tag size={12} className="text-secondary" />
                                                        <em>{route.mode}</em>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <Clock size={12} className="text-primary" />
                                                        {fmtTime(route.time_seconds)}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <Ruler size={12} className="text-secondary" />
                                                        {fmtDist(route.distance_meters)}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <Leaf size={12} className="text-success" />
                                                        {isFinite(route.co2_emissions) ? route.co2_emissions.toFixed(3) : "N/A"} kg CO₂
                                                    </div>
                                                    {route.cost != null && isFinite(route.cost) && (
                                                        <div className="d-flex align-items-center gap-1">
                                                            <Banknote size={12} className="text-danger" />
                                                            LKR {route.cost.toFixed(2)}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Google Maps link */}
                                                {rowData && (
                                                    <div style={{ paddingLeft:20, marginBottom:8 }}>
                                                        <a
                                                            href={buildMapsUrl(rowData)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="btn btn-sm btn-outline-success w-100 d-flex align-items-center justify-content-center gap-1"
                                                            style={{ fontSize: 12 }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Map size={12} /> Open in Google Maps
                                                        </a>
                                                    </div>
                                                )}

                                                {/* Email to driver */}
                                                <div
                                                    style={{ paddingLeft:20 }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="input-group input-group-sm">
                                                        <input
                                                            type="email"
                                                            className="form-control"
                                                            placeholder="Driver email..."
                                                            value={emailInputs[tripName] || ""}
                                                            onChange={(e) =>
                                                                setEmailInputs((prev) => ({ ...prev, [tripName]: e.target.value }))
                                                            }
                                                        />
                                                        <button
                                                            className={`btn d-flex align-items-center gap-1 ${emailSent[tripName] ? "btn-success" : "btn-primary"}`}
                                                            onClick={() => handleSendEmail({ tripName, color, route, rowData })}
                                                            disabled={emailSending[tripName] || emailSent[tripName]}
                                                            title="Send route to driver"
                                                        >
                                                            {emailSending[tripName] ? (
                                                                <span className="spinner-border spinner-border-sm" />
                                                            ) : emailSent[tripName] ? (
                                                                <><CheckCircle size={13} /> Sent</>
                                                            ) : (
                                                                <><Send size={13} /> Send</>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="d-flex align-items-center gap-1 text-danger"
                                                 style={{ fontSize: 13, paddingLeft: 20 }}>
                                                <XCircle size={13} />
                                                Optimization failed
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}