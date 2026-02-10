import React, {useState, useEffect} from "react";
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
import RouteAnimator from "./RouteAnimator.jsx";

const createIcon = (color) => {
    return new L.Icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
        shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
};

const GreenIcon = createIcon("green");
const RedIcon = createIcon("red");


const createNumberIcon = (num) =>
    L.divIcon({
        className: "",
        html: `
      <div style="
        width: 28px; height: 28px;
        border-radius: 50%;
        background: #ffc107;
        border: 2px solid rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: #1f2937;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      ">
        ${num}
      </div>
    `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
    });

const FitBounds = ({routes}) => {
    const map = useMap();
    useEffect(() => {
        if (!routes || routes.length === 0) return;
        const validRoute = routes.find((r) => r.route_sequence?.length > 0);
        if (validRoute) {
            const bounds = validRoute.route_sequence.map((p) => [
                parseFloat(p.lat),
                parseFloat(p.lon),
            ]);
            map.fitBounds(bounds, {padding: [50, 50]});
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
            minWidth: 170,
        }}
    >
        <div style={{fontWeight: 700, marginBottom: 8}}>Legend</div>

        <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
            <div style={{width: 34, height: 5, background: "#0d6efd", borderRadius: 3}}/>
            <span>Optimal</span>
        </div>

        <div style={{display: "flex", alignItems: "center", gap: 8}}>
            <div style={{width: 34, height: 0, borderTop: "5px dashed #6c757d"}}/>
            <span>Alternatives</span>
        </div>

        <div style={{marginTop: 8, color: "#6b7280"}}>Click a route to highlight</div>
    </div>
);

const RouteBuilder = () => {
    const savedLocations = [
        {id: 1, name: "Colombo Fort (Station)", lat: 6.9344, lon: 79.8428},
        {id: 2, name: "Town Hall", lat: 6.9147, lon: 79.8633},
        {id: 3, name: "Borella Junction", lat: 6.9122, lon: 79.8829},
        {id: 4, name: "Rajagiriya", lat: 6.909, lon: 79.8967},
        {id: 5, name: "Malabe SLIIT", lat: 6.9061, lon: 79.9647},
    ];

    const [request, setRequest] = useState({
        start: null,
        end: null,
        stops: [],
        trafficFactor: 1.0,
        weightKg: 50.0,
        vehicleType: "MEDIUM",
    });

    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);

    // Handlers
    const handleLocationChange = (type, id) => {
        const loc = savedLocations.find((l) => l.id === parseInt(id, 10));
        setRequest((prev) => ({...prev, [type]: loc}));
    };

    const addStop = () => {
        setRequest((prev) => ({
            ...prev,
            stops: [...prev.stops, {id: Date.now(), location: null}],
        }));
    };

    const handleStopChange = (rowId, locId) => {
        const loc = savedLocations.find((l) => l.id === parseInt(locId, 10));
        const updatedStops = request.stops.map((s) =>
            s.id === rowId ? {...s, location: loc} : s
        );
        setRequest((prev) => ({...prev, stops: updatedStops}));
    };

    const removeStop = (rowId) => {
        setRequest((prev) => ({
            ...prev,
            stops: prev.stops.filter((s) => s.id !== rowId),
        }));
    };

    const handleOptimize = async () => {
        if (!request.start || !request.end) {
            alert("Please select Start and End!");
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
            trafficFactor: parseFloat(request.trafficFactor),
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
            const res = await axios.post(
                "http://localhost:8080/api/routes/optimize",
                payload
            );
            setRoutes(res.data || []);
            if (res.data?.length > 0) setSelectedRoute(res.data[0]);
            else setSelectedRoute(null);
        } catch (err) {
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
            a.co2_emissions === b.co2_emissions &&
            a.cost_currency === b.cost_currency
        );
    };

    return (
        <div className="d-flex vh-100 w-100" style={{overflow: "hidden"}}>
            <div
                className="bg-light p-3 border-end d-flex flex-column"
                style={{
                    width: "400px",
                    height: "100vh",
                    overflowY: "auto",
                    zIndex: 1000,
                    boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
                }}
            >
                <h4 className="mb-4 text-primary">🚛 RouteSense</h4>

                <div className="card p-3 mb-3 shadow-sm">
                    <div className="mb-2">
                        <label className="fw-bold text-success">🟢 Start Point</label>
                        <select
                            className="form-select"
                            onChange={(e) => handleLocationChange("start", e.target.value)}
                        >
                            <option value="">-- Select --</option>
                            {savedLocations.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-2">
                        <label className="fw-bold text-danger">🔴 Destination</label>
                        <select
                            className="form-select"
                            onChange={(e) => handleLocationChange("end", e.target.value)}
                        >
                            <option value="">-- Select --</option>
                            {savedLocations.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-2 border-top pt-2">
                        <div className="d-flex justify-content-between mb-1">
                            <label className="fw-bold text-warning">🟡 Stops</label>
                            <button className="btn btn-sm btn-outline-secondary" onClick={addStop}>
                                + Add
                            </button>
                        </div>

                        {request.stops.map((s, i) => (
                            <div key={s.id} className="d-flex gap-2 mb-2">
                                <span className="small pt-2 fw-bold">{i + 1}.</span>
                                <select
                                    className="form-select form-select-sm"
                                    onChange={(e) => handleStopChange(s.id, e.target.value)}
                                >
                                    <option value="">-- Select --</option>
                                    {savedLocations.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name}
                                        </option>
                                    ))}
                                </select>
                                <button className="btn btn-sm btn-danger" onClick={() => removeStop(s.id)}>
                                    x
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mb-2 border-top pt-2">
                        <label className="fw-bold">🚚 Vehicle Type</label>
                        <select
                            className="form-select"
                            value={request.vehicleType}
                            onChange={(e) =>
                                setRequest((prev) => ({...prev, vehicleType: e.target.value}))
                            }
                        >
                            <option value="LIGHT">Light Truck (≤ 2T)</option>
                            <option value="MEDIUM">Medium Truck (≤ 10T)</option>
                            <option value="HEAVY">Heavy Truck (≤ 20T)</option>
                        </select>
                    </div>

                    <div className="mb-2 border-top pt-2">
                        <label className="fw-bold">
                            🚦 Traffic Factor:{" "}
                            <span className="text-primary">{request.trafficFactor.toFixed(1)}x</span>
                        </label>

                        <input
                            type="range"
                            className="form-range"
                            min="1.0"
                            max="2.0"
                            step="0.1"
                            value={request.trafficFactor}
                            onChange={(e) =>
                                setRequest((prev) => ({
                                    ...prev,
                                    trafficFactor: parseFloat(e.target.value),
                                }))
                            }
                        />

                        <div className="d-flex justify-content-between small text-muted">
                            <span>Light</span>
                            <span>Heavy</span>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary w-100 mt-2"
                        onClick={handleOptimize}
                        disabled={loading}
                    >
                        {loading ? "Calculating..." : "Visualize Route"}
                    </button>

                    <button
                        className="btn btn-warning"
                        onClick={() => setIsAnimating(true)}
                        disabled={!selectedRoute} // Only active if a route is selected
                    >
                        ▶ Sim
                    </button>
                </div>

                {selectedRoute && (
                    <div className="card shadow-sm border-primary">
                        <div className="card-header bg-primary text-white fw-bold">
                            📋 Route Details
                        </div>
                        <div className="card-body">
                            <h5 className="card-title">{selectedRoute.mode}</h5>
                            <p className="card-text small text-muted">{selectedRoute.explanation}</p>

                            <hr/>

                            <div className="d-flex justify-content-between text-center">
                                <div>
                                    <small className="text-muted">Time</small>
                                    <br/>
                                    <strong>{(selectedRoute.time_seconds / 60).toFixed(0)} min</strong>
                                </div>

                                <div>
                                    <small className="text-muted">CO2</small>
                                    <br/>
                                    <strong>{selectedRoute.co2_emissions.toFixed(2)} kg</strong>
                                </div>

                                <div>
                                    <small className="text-muted">Cost</small>
                                    <br/>
                                    <strong>Rs. {selectedRoute.cost_currency.toFixed(0)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-grow-1" style={{position: "relative", height: "100vh"}}>
                <MapContainer
                    center={[6.9271, 79.8612]}
                    zoom={13}
                    style={{height: "100%", width: "100%"}}
                >
                    <TileLayer
                        url="http://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        attribution='&copy; Google Maps'
                    />

                    {/*<TileLayer*/}
                    {/*    attribution='&copy; OpenStreetMap'*/}
                    {/*    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"*/}
                    {/*/>|*/}

                    {/*<TileLayer*/}
                    {/*    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'*/}
                    {/*    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"*/}
                    {/*/>*/}

                    <FitBounds routes={routes}/>

                    {selectedRoute && (
                        <RouteAnimator
                            key={selectedRoute.mode + selectedRoute.time_seconds}

                            routeCoordinates={selectedRoute.route_sequence.map(p => [parseFloat(p.lat), parseFloat(p.lon)])}
                            isPlaying={isAnimating}
                            onAnimationEnd={() => setIsAnimating(false)}
                        />
                    )}

                    {request.start && (
                        <Marker position={[request.start.lat, request.start.lon]} icon={GreenIcon}>
                            <Popup>Start: {request.start.name}</Popup>
                        </Marker>
                    )}

                    {request.end && (
                        <Marker position={[request.end.lat, request.end.lon]} icon={RedIcon}>
                            <Popup>End: {request.end.name}</Popup>
                        </Marker>
                    )}

                    {request.stops.map((s, i) =>
                        s.location ? (
                            <Marker
                                key={s.id}
                                position={[s.location.lat, s.location.lon]}
                                icon={createNumberIcon(i + 1)}
                            >
                                <Popup>
                                    <b>Stop {i + 1}</b>: {s.location.name}
                                </Popup>
                            </Marker>
                        ) : null
                    )}

                    {routes.map((route, index) => {
                        const positions = (route.route_sequence || []).map((p) => [
                            parseFloat(p.lat),
                            parseFloat(p.lon),
                        ]);
                        if (positions.length === 0) return null;

                        const isOptimal = route.mode?.includes("Optimal");
                        const selected = isSameRoute(selectedRoute, route);

                        const dimOthers = !!selectedRoute;
                        const opacity = !dimOthers
                            ? isOptimal
                                ? 0.95
                                : 0.75
                            : selected
                                ? 0.95
                                : 0.25;

                        const weight = selected ? (isOptimal ? 9 : 7) : isOptimal ? 8 : 6;

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
                                    <strong>{route.mode}</strong>
                                    <br/>
                                    Time: {(route.time_seconds / 60).toFixed(0)} min
                                    <br/>
                                    CO2: {route.co2_emissions.toFixed(2)} kg
                                    <br/>
                                    Cost: Rs. {route.cost_currency.toFixed(0)}
                                </Popup>
                            </Polyline>
                        );
                    })}
                </MapContainer>

                <RouteLegend/>
            </div>
        </div>
    );
};

export default RouteBuilder;
