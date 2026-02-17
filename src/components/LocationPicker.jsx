import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import axios from "axios";
import L from "leaflet";

// Fix for default marker icon
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle map clicks
const MapClickHandler = ({ onLocationSelect }) => {
    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            // Reverse Geocode (Get name from lat/lon)
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                .then((res) => res.json())
                .then((data) => {
                    onLocationSelect({
                        lat: lat,
                        lon: lng,
                        name: data.display_name.split(",")[0], // Get just the first part of the address
                    });
                });
        },
    });
    return null;
};

const LocationPicker = ({ onClose, onConfirm }) => {
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(null);
    const [mapCenter, setMapCenter] = useState([6.9271, 79.8612]); // Colombo

    // 1. Search Function (Nominatim API)
    const handleSearch = async () => {
        if (!query) return;
        try {
            const res = await axios.get(
                `https://nominatim.openstreetmap.org/search?format=json&q=${query}+Sri+Lanka`
            );
            if (res.data && res.data.length > 0) {
                const firstResult = res.data[0];
                const lat = parseFloat(firstResult.lat);
                const lon = parseFloat(firstResult.lon);

                setSelected({ lat, lon, name: firstResult.display_name.split(",")[0] });
                setMapCenter([lat, lon]); // Move map to search result
            } else {
                alert("Location not found!");
            }
        } catch (err) {
            console.error(err);
            alert("Search failed.");
        }
    };

    // 2. Re-center map when searching
    const ChangeView = ({ center }) => {
        const map = useMapEvents({});
        map.setView(center, 13);
        return null;
    };

    return (
        <div
            style={{
                position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999,
                display: "flex", justifyContent: "center", alignItems: "center"
            }}
        >
            <div className="bg-white p-3 rounded shadow-lg" style={{ width: "90%", maxWidth: "600px" }}>
                <h5 className="mb-3">📍 Pick a Location</h5>

                {/* Search Bar */}
                <div className="input-group mb-3">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search city (e.g., Kandy)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button className="btn btn-primary" onClick={handleSearch}>Search</button>
                </div>

                {/* The Map */}
                <div style={{ height: "300px", border: "1px solid #ddd", marginBottom: "15px" }}>
                    <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />
                        <ChangeView center={mapCenter} />
                        <MapClickHandler onLocationSelect={setSelected} />
                        {selected && <Marker position={[selected.lat, selected.lon]} />}
                    </MapContainer>
                </div>

                {/* Selected Info */}
                {selected && (
                    <div className="alert alert-info py-2 small">
                        Selected: <strong>{selected.name}</strong> <br/>
                        ({selected.lat.toFixed(4)}, {selected.lon.toFixed(4)})
                    </div>
                )}

                {/* Actions */}
                <div className="d-flex justify-content-end gap-2">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-success"
                        onClick={() => onConfirm(selected)}
                        disabled={!selected}
                    >
                        Confirm Location
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationPicker;