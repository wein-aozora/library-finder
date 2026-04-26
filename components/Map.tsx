"use client";

import { useEffect, useRef } from "react";
import type { Library } from "./LibraryFinder";

interface MapProps {
  center: [number, number];
  libraries: Library[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Map({ center, libraries, selectedId, onSelect }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, import("leaflet").Marker>>(new globalThis.Map());

  useEffect(() => {
    if (!containerRef.current) return;

    let L: typeof import("leaflet");

    const init = async () => {
      L = (await import("leaflet")).default;

      // Fix default marker icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (mapRef.current) return;

      const map = L.map(containerRef.current!).setView(center, 14);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Current location marker
      const locationIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker(center, { icon: locationIcon })
        .addTo(map)
        .bindPopup("<b>現在地</b>");
    };

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const updateMarkers = async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;

      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      const libraryIcon = L.divIcon({
        className: "",
        html: `<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);font-size:14px">📚</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const selectedIcon = L.divIcon({
        className: "",
        html: `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#f59e0b;border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.5);font-size:16px">📚</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      libraries.forEach((lib) => {
        const isSelected = lib.id === selectedId;
        const marker = L.marker([lib.lat, lib.lon], {
          icon: isSelected ? selectedIcon : libraryIcon,
        }).addTo(map);

        const popupContent = `
          <div style="min-width:180px">
            <b style="font-size:14px">${lib.name}</b>
            ${lib.address ? `<br><span style="color:#666;font-size:12px">📍 ${lib.address}</span>` : ""}
            ${lib.opening_hours ? `<br><span style="color:#666;font-size:12px">🕐 ${lib.opening_hours}</span>` : ""}
            ${lib.phone ? `<br><span style="color:#666;font-size:12px">📞 ${lib.phone}</span>` : ""}
            ${lib.website ? `<br><a href="${lib.website}" target="_blank" style="color:#3b82f6;font-size:12px">🔗 ウェブサイト</a>` : ""}
          </div>
        `;
        marker.bindPopup(popupContent, { className: "library-popup" });
        marker.on("click", () => onSelect(lib.id));

        markersRef.current.set(lib.id, marker);
      });

      if (selectedId) {
        const selectedMarker = markersRef.current.get(selectedId);
        if (selectedMarker) {
          selectedMarker.openPopup();
          map.panTo(selectedMarker.getLatLng(), { animate: true });
        }
      }
    };

    updateMarkers();
  }, [libraries, selectedId, onSelect]);

  return <div ref={containerRef} className="w-full h-full rounded-xl" />;
}
