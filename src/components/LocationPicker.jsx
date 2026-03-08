import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import axios from "axios";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Handle map clicks
const MapClickHandler = ({ onLocationSelect, setQuery }) => {
    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                .then((res) => res.json())
                .then((data) => {
                    const name = data.display_name.split(",")[0];
                    onLocationSelect({ lat: lat, lon: lng, name: name });
                    setQuery(name); // Update the search box
                });
        },
    });
    return null;
};

const LocationPicker = ({ onClose, onConfirm }) => {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [mapCenter, setMapCenter] = useState([6.9271, 79.8612]); // Colombo
    const [isSearching, setIsSearching] = useState(false);

    // Autocomplete effect (runs when query changes)
    useEffect(() => {
        // Wait 500ms before calling API
        const delayTimer = setTimeout(async () => {
            if (query.length > 2) {
                setIsSearching(true);
                try {
                    // 1. Use Photon API limited to Sri Lanka map bounds
                    const res = await axios.get(
                        `https://photon.komoot.io/api/?q=${query}&bbox=79.5,5.9,81.9,9.9&limit=5`
                    );

                    // 2. Format Photon data to match our app
                    const formattedData = res.data.features.map(f => ({
                        lat: f.geometry.coordinates[1],
                        lon: f.geometry.coordinates[0],
                        display_name: [f.properties.name, f.properties.city, f.properties.state]
                            .filter(Boolean).join(", ")
                    }));

                    setSuggestions(formattedData);
                } catch (err) {
                    console.error("Search error", err);
                }
                setIsSearching(false);
            } else {
                setSuggestions([]); // Clear box
            }
        }, 500);

        return () => clearTimeout(delayTimer);
    }, [query]);

    // Handle clicking a suggestion from the dropdown
    const handleSelectSuggestion = (item) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const name = item.display_name.split(",")[0];

        setSelected({ lat, lon, name });
        setMapCenter([lat, lon]); // Move map
        setQuery(name); // Put selected name in box
        setSuggestions([]); // Hide dropdown
    };

    // Re-center map component
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

                {/* Search Bar with Autocomplete */}
                <div style={{ position: "relative", marginBottom: "15px" }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search city (e.g., Kandy)"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            // Clear selection if user starts typing again
                            if (selected) setSelected(null);
                        }}
                    />

                    {isSearching && <small className="text-muted mt-1 d-block">Searching...</small>}

                    {/* Dropdown Suggestions */}
                    {suggestions.length > 0 && (
                        <ul className="list-group" style={{
                            position: "absolute", width: "100%", zIndex: 1000,
                            maxHeight: "200px", overflowY: "auto", boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                        }}>
                            {suggestions.map((item, index) => (
                                <li
                                    key={index}
                                    className="list-group-item list-group-item-action"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelectSuggestion(item)}
                                >
                                    <strong>{item.display_name.split(",")[0]}</strong>
                                    <br/>
                                    <small className="text-muted">{item.display_name}</small>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* The Map */}
                <div style={{ height: "300px", border: "1px solid #ddd", marginBottom: "15px", position: "relative", zIndex: 1 }}>
                    <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                        <TileLayer
                            url="http://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                            attribution='&copy; Google Maps'
                        />
                        <ChangeView center={mapCenter} />
                        <MapClickHandler onLocationSelect={setSelected} setQuery={setQuery} />
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