import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TestMap = () => {
    return (
        <div style={{ border: "5px solid red", padding: "10px" }}>
            <h3>If you see the map below, Leaflet is working!</h3>

            <MapContainer
                center={[6.9271, 79.8612]}
                zoom={13}
                style={{ height: "500px", width: "100%" }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                />
                <Marker position={[6.9271, 79.8612]}>
                    <Popup>Colombo</Popup>
                </Marker>
            </MapContainer>
        </div>
    );
};

export default TestMap;