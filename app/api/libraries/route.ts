import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const radius = searchParams.get("radius") ?? "3000";

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  const query = `
    [out:json][timeout:30];
    (
      node["amenity"="library"](around:${radius},${lat},${lon});
      way["amenity"="library"](around:${radius},${lat},${lon});
      relation["amenity"="library"](around:${radius},${lat},${lon});
    );
    out center tags;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Overpass API returned ${res.status}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
