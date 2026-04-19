import React, { useEffect, useState, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

const truckIcon = L.divIcon({
    className: "",
    html: `
        <div style="
            width:36px;height:36px;
            background:#1d4ed8;
            border-radius:50%;
            border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.35);
            display:flex;align-items:center;justify-content:center;">
            <svg xmlns="http://www.w3.org/2000/svg"
                width="20" height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round">
                <path d="M1 3h15v13H1z"/>
                <path d="M16 8h4l3 4v4h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
        </div>`,
    iconSize:    [36, 36],
    iconAnchor:  [18, 18],
    popupAnchor: [0, -20],
});

const RouteAnimator = ({ routeCoordinates, isPlaying, onAnimationEnd }) => {
    const [position, setPosition] = useState(
        routeCoordinates && routeCoordinates.length > 0 ? routeCoordinates[0] : null
    );

    const requestRef = useRef();
    const indexRef   = useRef(0);

    useEffect(() => {
        if (!isPlaying || !routeCoordinates || routeCoordinates.length === 0) {
            cancelAnimationFrame(requestRef.current);
            return;
        }

        const animate = () => {
            const speed = 1;
            indexRef.current += speed;

            if (indexRef.current < routeCoordinates.length) {
                setPosition(routeCoordinates[indexRef.current]);
                requestRef.current = requestAnimationFrame(animate);
            } else {
                setPosition(routeCoordinates[routeCoordinates.length - 1]);
                cancelAnimationFrame(requestRef.current);
                if (onAnimationEnd) onAnimationEnd();
            }
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [isPlaying, routeCoordinates, onAnimationEnd]);

    if (!position) return null;

    return (
        <Marker position={position} icon={truckIcon} zIndexOffset={1000}>
            <Popup>
                <strong>Delivery in Progress</strong>
            </Popup>
        </Marker>
    );
};

export default RouteAnimator;