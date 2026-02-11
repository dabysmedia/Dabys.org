import { NextResponse } from "next/server";

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
const LIMIT = 30;

export async function GET(request: Request) {
  if (!GIPHY_API_KEY) {
    return NextResponse.json({ data: [], noKey: true });
  }

  const { searchParams } = new URL(request.url);
  const offset = Math.min(parseInt(searchParams.get("offset") || "0", 10), 499);
  const limit = Math.min(parseInt(searchParams.get("limit") || String(LIMIT), 10), 50);

  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&offset=${offset}&rating=g`
    );
    const json = await res.json();

    if (json.meta?.status !== 200) {
      return NextResponse.json({ data: [], error: json.meta?.msg });
    }

    const data = (json.data || []).map((g: { id: string; embed_url: string; images: { fixed_height_small?: { url: string }; fixed_height?: { url: string }; downsized_small?: { url: string } }; title: string }) => ({
      id: g.id,
      embedUrl: g.embed_url,
      thumbnail: g.images?.fixed_height_small?.url || g.images?.fixed_height?.url || "",
      title: g.title || "",
    }));

    return NextResponse.json({ data, pagination: json.pagination });
  } catch (e) {
    console.error("GIPHY trending error", e);
    return NextResponse.json({ data: [], error: "Request failed" });
  }
}
