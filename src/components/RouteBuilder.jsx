import React, { useState } from 'react';
import axios from 'axios';
import MapComponent from './MapComponent';

const RouteBuilder = () => {
    // 1. MOCK DATA (Hardcoded for testing - replace with database later)
    const savedLocations = [
        { id: 1, name: "Colombo Fort (Station)", lat: 6.9344, lon: 79.8428 },
        { id: 2, name: "Town Hall", lat: 6.9147, lon: 79.8633 },
        { id: 3, name: "Borella Junction", lat: 6.9122, lon: 79.8829 },
        { id: 4, name: "Rajagiriya", lat: 6.9090, lon: 79.8967 },
        { id: 5, name: "Malabe SLIIT", lat: 6.9061, lon: 79.9647 }
    ];

    // 2. STATE
    const [request, setRequest] = useState({
        start: null,
        end: null,
        stops: [],
        trafficFactor: 1.0,
        weightKg: 50.0
    });
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(false);

    // 3. HANDLERS
    const handleLocationChange = (type, id) => {
        const loc = savedLocations.find(l => l.id === parseInt(id));
        setRequest(prev => ({ ...prev, [type]: loc }));
    };

    const addStop = () => {
        setRequest(prev => ({
            ...prev,
            stops: [...prev.stops, { id: Date.now(), location: null }]
        }));
    };

    const handleStopChange = (rowId, locId) => {
        const loc = savedLocations.find(l => l.id === parseInt(locId));
        const updatedStops = request.stops.map(s =>
            s.id === rowId ? { ...s, location: loc } : s
        );
        setRequest(prev => ({ ...prev, stops: updatedStops }));
    };

    const removeStop = (rowId) => {
        setRequest(prev => ({
            ...prev,
            stops: prev.stops.filter(s => s.id !== rowId)
        }));
    };

    const handleOptimize = async () => {
        if (!request.start || !request.end) {
            alert("Please select Start and End!");
            return;
        }
        setLoading(true);

        // Prepare JSON for Backend
        const payload = {
            startLat: request.start.lat,
            startLon: request.start.lon,
            startName: request.start.name,
            endLat: request.end.lat,
            endLon: request.end.lon,
            endName: request.end.name,
            trafficFactor: parseFloat(request.trafficFactor),
            weightKg: parseFloat(request.weightKg),
            stops: request.stops
                .filter(s => s.location)
                .map(s => ({
                    name: s.location.name,
                    latitude: s.location.lat,
                    longitude: s.location.lon
                }))
        };

        try {
            const res = await axios.post('http://localhost:8080/api/routes/optimize', payload);
            setRoutes(res.data);
        } catch (err) {
            console.error(err);
            alert("Backend Error - Is Spring Boot running?");
        }
        setLoading(false);
    };

    return (
        <div className="d-flex vh-100 flex-column">
            {/* Header */}
            <div className="bg-dark text-white p-3 shadow-sm z-3">
                <h4 className="m-0">🚛 RouteSense <span className="fs-6 badge bg-primary">Prototype</span></h4>
            </div>

            <div className="d-flex flex-grow-1">
                {/* Sidebar Controls */}
                <div className="bg-light p-3 border-end" style={{ width: "350px", overflowY: "auto" }}>

                    <div className="mb-3">
                        <label className="fw-bold">Start Point</label>
                        <select className="form-select" onChange={(e) => handleLocationChange('start', e.target.value)}>
                            <option value="">-- Select --</option>
                            {savedLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>

                    <div className="mb-3">
                        <label className="fw-bold">Destination</label>
                        <select className="form-select" onChange={(e) => handleLocationChange('end', e.target.value)}>
                            <option value="">-- Select --</option>
                            {savedLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>

                    <div className="mb-3 border-top pt-3">
                        <div className="d-flex justify-content-between mb-2">
                            <label className="fw-bold">Stops</label>
                            <button className="btn btn-sm btn-outline-secondary" onClick={addStop}>+ Add</button>
                        </div>
                        {request.stops.map((s, i) => (
                            <div key={s.id} className="d-flex gap-2 mb-2">
                                <span className="small pt-2">{i+1}.</span>
                                <select className="form-select form-select-sm" onChange={(e) => handleStopChange(s.id, e.target.value)}>
                                    <option value="">-- Select --</option>
                                    {savedLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                                <button className="btn btn-sm btn-danger" onClick={() => removeStop(s.id)}>x</button>
                            </div>
                        ))}
                    </div>

                    <div className="mb-4">
                        <label className="form-label small">Traffic: <strong>{request.trafficFactor}x</strong></label>
                        <input
                            type="range" className="form-range" min="1.0" max="2.0" step="0.1"
                            value={request.trafficFactor}
                            onChange={(e) => setRequest({...request, trafficFactor: e.target.value})}
                        />
                    </div>

                    <button className="btn btn-primary w-100" onClick={handleOptimize} disabled={loading}>
                        {loading ? "Optimizing..." : "Visualize Route"}
                    </button>
                </div>

                {/* Map Area */}
                <div className="flex-grow-1 position-relative">
                    <MapComponent routes={routes} requestPoints={request} />
                </div>
            </div>
        </div>
    );
};

export default RouteBuilder;