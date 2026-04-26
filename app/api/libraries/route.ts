import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const radius = searchParams.get("radius") ?? "3000";

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  const query = `[out:json][timeout:25];(node["amenity"="library"](around:${radius},${lat},${lon});way["amenity"="library"](around:${radius},${lat},${lon});relation["amenity"="library"](around:${radius},${lat},${lon}););out center tags;`;

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "*/*",
    "Accept-Encoding": "identity",
    "User-Agent": "Mozilla/5.0 (compatible; library-finder/1.0)",
    "Content-Length": String(Buffer.byteLength(query)),
  };

  let lastError = "";

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(endpoint, {
        method: "POST",
        body: query,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        lastError = `${endpoint} returned ${res.status}`;
        continue;
      }

      const data = await res.json();
      return NextResponse.json(data);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
