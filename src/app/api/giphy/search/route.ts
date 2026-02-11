import { NextResponse } from "next/server";

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
const LIMIT = 30;

export async function GET(request: Request) {
  if (!GIPHY_API_KEY) {
    return NextResponse.json({ data: [], noKey: true });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 50);
  const offset = Math.min(parseInt(searchParams.get("offset") || "0", 10), 4999);
  const limit = Math.min(parseInt(searchParams.get("limit") || String(LIMIT), 10), 50);

  if (!q) {
    return NextResponse.json({ data: [] });
  }

  try {
    const url = new URL("https://api.giphy.com/v1/gifs/search");
    url.searchParams.set("api_key", GIPHY_API_KEY);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("rating", "g");

    const res = await fetch(url.toString());
    const json = await res.json();

    if (json.meta?.status !== 200) {
      return NextResponse.json({ data: [], error: json.meta?.msg });
    }

    const data = (json.data || []).map((g: { id: string; embed_url: string; images: { fixed_height_small?: { url: string }; fixed_height?: { url: string } }; title: string }) => ({
      id: g.id,
      embedUrl: g.embed_url,
      thumbnail: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url || "",
      title: g.title || "",
    }));

    return NextResponse.json({ data, pagination: json.pagination });
  } catch (e) {
    console.error("GIPHY search error", e);
    return NextResponse.json({ data: [], error: "Request failed" });
  }
}
