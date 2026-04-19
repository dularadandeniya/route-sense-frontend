import L from "leaflet";
export const createDotIcon = (color) =>
    L.divIcon({
        className: "",
        html: `<div style="
            width:13px;height:13px;border-radius:50%;
            background:${color};border:2px solid white;
            box-shadow:0 2px 5px rgba(0,0,0,0.35);">
        </div>`,
        iconSize: [13, 13],
        iconAnchor: [6, 6],
    });

export const createPinIcon = (color = "#0d6efd", label = "") =>
    L.divIcon({
        className: "",
        html: `
        <div style="position:relative;width:28px;height:38px;">
            <svg viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg" width="28" height="38">
                <path d="M14 0C6.27 0 0 6.27 0 14c0 9.625 14 24 14 24S28 23.625 28 14C28 6.27 21.73 0 14 0z"
                      fill="${color}" stroke="white" stroke-width="1.5"/>
                <circle cx="14" cy="14" r="6" fill="white"/>
            </svg>
            ${label ? `<div style="
                position:absolute;top:6px;left:50%;transform:translateX(-50%);
                font-size:9px;font-weight:700;color:${color};line-height:1;">
                ${label}
            </div>` : ""}
        </div>`,
        iconSize: [28, 38],
        iconAnchor: [14, 38],
        popupAnchor: [0, -38],
    });

export const createNumberIcon = (num, color = "#f59e0b") =>
    L.divIcon({
        className: "",
        html: `
        <div style="
            width:28px;height:28px;border-radius:50%;
            background:${color};border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-weight:700;color:white;font-size:12px;">
            ${num}
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -18],
    });

export const GreenPin  = createPinIcon("#16a34a");
export const RedPin    = createPinIcon("#dc2626");
export const BluePin   = createPinIcon("#2563eb");