import React, { useEffect, useState, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

// 1. Define the Custom Truck Icon (using an Emoji for simplicity)
const truckIcon = L.divIcon({
    className: "custom-truck-icon",
    html: `<div style="font-size: 24px; line-height: 1;">🚚</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
});

const RouteAnimator = ({ routeCoordinates, isPlaying, onAnimationEnd }) => {
    // Initialize state directly from props (Avoids the useEffect error)
    const [position, setPosition] = useState(
        routeCoordinates && routeCoordinates.length > 0 ? routeCoordinates[0] : null
    );

    const requestRef = useRef();
    const indexRef = useRef(0);

    useEffect(() => {
        // 1. Guard Clauses: Stop if not playing or invalid data
        if (!isPlaying || !routeCoordinates || routeCoordinates.length === 0) {
            cancelAnimationFrame(requestRef.current);
            return;
        }

        // 2. The Animation Loop
        const animate = () => {
            // 1 = Slow (every point), 5 = Fast (skip 5 points per frame)
            const speed = 1;

            indexRef.current += speed;

            // Check if we are still within the route array
            if (indexRef.current < routeCoordinates.length) {
                const nextPos = routeCoordinates[indexRef.current];
                setPosition(nextPos);

                // Loop again
                requestRef.current = requestAnimationFrame(animate);
            } else {
                // End of Route: Snap to final point and stop
                setPosition(routeCoordinates[routeCoordinates.length - 1]);
                cancelAnimationFrame(requestRef.current);

                // Notify parent that animation is done
                if (onAnimationEnd) onAnimationEnd();
            }
        };

        // Start the loop
        requestRef.current = requestAnimationFrame(animate);

        // Cleanup: Stop animation if component unmounts
        return () => cancelAnimationFrame(requestRef.current);
    }, [isPlaying, routeCoordinates, onAnimationEnd]);

    // If no position is set, don't render anything
    if (!position) return null;

    return (
        <Marker position={position} icon={truckIcon} zIndexOffset={1000}>
            <Popup>
                <strong>Delivery in Progress</strong><br/>
            </Popup>
        </Marker>
    );
};

export default RouteAnimator;