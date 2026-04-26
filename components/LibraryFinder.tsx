"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";

export interface Library {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  opening_hours?: string;
  phone?: string;
  website?: string;
  distance?: number;
}

const Map = dynamic(() => import("./Map"), { ssr: false });

type Status = "idle" | "locating" | "searching" | "done" | "error";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchLibraries(lat: number, lon: number, radiusM: number): Promise<Library[]> {
  const res = await fetch(
    `/api/libraries?lat=${lat}&lon=${lon}&radius=${radiusM}`
  );

  if (!res.ok) throw new Error("図書館の検索に失敗しました");

  const data = await res.json();

  return (data.elements as Record<string, unknown>[])
    .map((el) => {
      const tags = (el.tags ?? {}) as Record<string, string>;
      const elLat = (el.lat ?? (el.center as Record<string, number>)?.lat) as number;
      const elLon = (el.lon ?? (el.center as Record<string, number>)?.lon) as number;

      if (!elLat || !elLon) return null;

      const name = tags["name"] ?? tags["name:ja"] ?? "図書館";
      const addr = [
        tags["addr:province"],
        tags["addr:city"],
        tags["addr:suburb"],
        tags["addr:quarter"],
        tags["addr:neighbourhood"],
        tags["addr:block_number"],
        tags["addr:housenumber"],
      ]
        .filter(Boolean)
        .join("");

      return {
        id: String(el.id),
        name,
        lat: elLat,
        lon: elLon,
        address: addr || tags["addr:full"] || undefined,
        opening_hours: tags["opening_hours"],
        phone: tags["phone"] ?? tags["contact:phone"],
        website: tags["website"] ?? tags["contact:website"] ?? tags["url"],
        distance: haversineKm(lat, lon, elLat, elLon),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a!.distance ?? 0) - (b!.distance ?? 0)) as Library[];
}

const RADIUS_OPTIONS = [
  { label: "500m", value: 500 },
  { label: "1km", value: 1000 },
  { label: "3km", value: 3000 },
  { label: "5km", value: 5000 },
  { label: "10km", value: 10000 },
];

export default function LibraryFinder() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [radius, setRadius] = useState(3000);

  const search = useCallback(async () => {
    setStatus("locating");
    setError("");
    setLibraries([]);
    setSelectedId(null);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );

      const { latitude, longitude } = pos.coords;
      setLocation([latitude, longitude]);
      setStatus("searching");

      const results = await fetchLibraries(latitude, longitude, radius);
      setLibraries(results);
      setStatus("done");
    } catch (e) {
      const msg =
        e instanceof GeolocationPositionError
          ? e.code === 1
            ? "位置情報の許可が必要です。ブラウザの設定を確認してください。"
            : "現在地の取得に失敗しました。"
          : e instanceof Error
          ? e.message
          : "不明なエラーが発生しました。";
      setError(msg);
      setStatus("error");
    }
  }, [radius]);

  const selectedLib = libraries.find((l) => l.id === selectedId);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">📚</span> 近くの図書館を探す
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">OpenStreetMapのデータで現在地周辺の図書館を検索</p>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={status === "locating" || status === "searching"}
            >
              {RADIUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}以内
                </option>
              ))}
            </select>
            <button
              onClick={search}
              disabled={status === "locating" || status === "searching"}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {status === "locating" ? (
                <><Spinner /> 位置を取得中…</>
              ) : status === "searching" ? (
                <><Spinner /> 検索中…</>
              ) : (
                <><span>📍</span> 現在地で検索</>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Error */}
      {status === "error" && (
        <div className="max-w-6xl mx-auto w-full px-4 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            ⚠️ {error}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 flex flex-col lg:flex-row gap-4">
        {/* List */}
        <aside className="lg:w-80 flex-shrink-0">
          {status === "idle" && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-2">
              <span className="text-4xl">🗺️</span>
              <p>「現在地で検索」を押すと<br />周辺の図書館が表示されます</p>
            </div>
          )}

          {(status === "locating" || status === "searching") && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-3">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p>{status === "locating" ? "現在地を取得中…" : "図書館を検索中…"}</p>
            </div>
          )}

          {status === "done" && libraries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-2">
              <span className="text-4xl">😔</span>
              <p>この範囲には図書館が見つかりませんでした</p>
            </div>
          )}

          {status === "done" && libraries.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-slate-500 mb-2">
                {libraries.length}件見つかりました
              </p>
              {libraries.map((lib) => (
                <button
                  key={lib.id}
                  onClick={() => setSelectedId(lib.id === selectedId ? null : lib.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                    lib.id === selectedId
                      ? "bg-emerald-50 border-emerald-400 shadow-sm"
                      : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                  }`}
                >
                  <div className="font-semibold text-slate-800 text-sm">{lib.name}</div>
                  {lib.address && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate">📍 {lib.address}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {lib.distance !== undefined && (
                      <span className="text-xs text-emerald-600 font-medium">
                        {lib.distance < 1
                          ? `${Math.round(lib.distance * 1000)}m`
                          : `${lib.distance.toFixed(1)}km`}
                      </span>
                    )}
                    {lib.opening_hours && (
                      <span className="text-xs text-slate-400 truncate">🕐 {lib.opening_hours}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Map */}
        <div className="flex-1 min-h-[400px] lg:min-h-0">
          {location ? (
            <Map
              center={location}
              libraries={libraries}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
            />
          ) : (
            <div className="w-full h-full min-h-[400px] bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-5xl mb-3">🗺️</div>
                <p className="text-sm">検索するとマップが表示されます</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail panel */}
      {selectedLib && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4 z-[1000]">
          <div className="max-w-6xl mx-auto flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold text-slate-800">{selectedLib.name}</h2>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-600">
                {selectedLib.address && <span>📍 {selectedLib.address}</span>}
                {selectedLib.opening_hours && <span>🕐 {selectedLib.opening_hours}</span>}
                {selectedLib.phone && <span>📞 {selectedLib.phone}</span>}
                {selectedLib.website && (
                  <a href={selectedLib.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    🔗 ウェブサイト
                  </a>
                )}
                {selectedLib.distance !== undefined && (
                  <span className="text-emerald-600 font-medium">
                    現在地から{" "}
                    {selectedLib.distance < 1
                      ? `${Math.round(selectedLib.distance * 1000)}m`
                      : `${selectedLib.distance.toFixed(1)}km`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-slate-400 py-3">
        地図データ: © <a href="https://www.openstreetmap.org/copyright" className="hover:underline">OpenStreetMap</a> contributors
      </footer>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}
