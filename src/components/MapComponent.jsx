import React, {useEffect} from 'react';
import {MapContainer, TileLayer, Polyline, Marker, Popup, useMap} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const FitBounds = ({routes}) => {
    const map = useMap();

    useEffect(() => {
        if (!routes || routes.length === 0) return;

        const validRoute = routes.find(r => r.route_sequence && r.route_sequence.length > 0);
        if (validRoute) {
            // Force coordinates to be numbers for the bounds check
            const bounds = validRoute.route_sequence.map(p => [
                parseFloat(p.lat),
                parseFloat(p.lon)
            ]);
            if (bounds.length > 0) {
                map.fitBounds(bounds, {padding: [50, 50]});
            }
        }
    }, [routes, map]);

    return null;
};

const MapComponent = ({routes, requestPoints}) => {
    const center = [6.9271, 79.8612]; // Default Colombo

    // Ensure coordinates are Numbers
    const getPositions = (sequence) => {
        if (!sequence) return [];
        return sequence.map(p => [
            parseFloat(p.lat),
            parseFloat(p.lon)
        ]);
    };

    return (
        <div style={{height: "100%", width: "100%", border: "2px solid #ccc"}}>
            <MapContainer center={center} zoom={13} style={{height: "100%", width: "100%"}}>

                <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FitBounds routes={routes}/>

                {requestPoints.start && (
                    <Marker position={[requestPoints.start.lat, requestPoints.start.lon]}>
                        <Popup>Start: {requestPoints.start.name}</Popup>
                    </Marker>
                )}
                {requestPoints.end && (
                    <Marker position={[requestPoints.end.lat, requestPoints.end.lon]}>
                        <Popup>End: {requestPoints.end.name}</Popup>
                    </Marker>
                )}
                {requestPoints.stops.map((s, i) => s.location && (
                    <Marker key={s.id} position={[s.location.lat, s.location.lon]}>
                        <Popup>Stop {i + 1}: {s.location.name}</Popup>
                    </Marker>
                ))}

                {routes.map((route, index) => {
                    const positions = getPositions(route.route_sequence);
                    if (positions.length === 0) return null;

                    const isOptimal = route.mode.includes("Optimal");
                    return (
                        <Polyline
                            key={index}
                            positions={positions}
                            pathOptions={{
                                color: isOptimal ? "blue" : "grey",
                                weight: isOptimal ? 6 : 4,
                                opacity: 0.8
                            }}
                        >
                            <Popup>
                                <strong>{route.mode}</strong><br/>
                                Time: {(route.time_seconds / 60).toFixed(0)} min<br/>
                                CO2: {route.co2_emissions.toFixed(2)} kg
                            </Popup>
                        </Polyline>
                    );
                })}
            </MapContainer>
        </div>
    );
};

export default MapComponent;