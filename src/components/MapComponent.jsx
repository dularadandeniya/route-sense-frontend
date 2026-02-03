import React from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for missing marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapComponent = ({ routes, requestPoints }) => {
    const center = [6.9271, 79.8612]; // Default: Colombo

    const getPositions = (sequence) => {
        if (!sequence) return [];
        return sequence.map(p => [p.lat, p.lon]);
    };

    return (
        <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Draw Start Point */}
            {requestPoints.start && (
                <Marker position={[requestPoints.start.lat, requestPoints.start.lon]}>
                    <Popup>Start: {requestPoints.start.name}</Popup>
                </Marker>
            )}

            {/* Draw End Point */}
            {requestPoints.end && (
                <Marker position={[requestPoints.end.lat, requestPoints.end.lon]}>
                    <Popup>End: {requestPoints.end.name}</Popup>
                </Marker>
            )}

            {/* Draw Stops */}
            {requestPoints.stops.map((s, i) => s.location && (
                <Marker key={s.id} position={[s.location.lat, s.location.lon]}>
                    <Popup>Stop {i + 1}: {s.location.name}</Popup>
                </Marker>
            ))}

            {/* Draw Lines (Routes) */}
            {routes.map((route, index) => {
                const isOptimal = route.mode.includes("Optimal");
                return (
                    <Polyline
                        key={index}
                        positions={getPositions(route.route_sequence)}
                        pathOptions={{
                            color: isOptimal ? "#007bff" : "#6c757d", // Blue vs Grey
                            weight: isOptimal ? 6 : 4,
                            opacity: isOptimal ? 0.9 : 0.5
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
    );
};

export default MapComponent;