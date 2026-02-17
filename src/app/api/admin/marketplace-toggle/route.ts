import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getSiteSettings,
  disableMarketplace,
  enableMarketplace,
} from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const settings = getSiteSettings();
  return NextResponse.json({ marketplaceEnabled: settings.marketplaceEnabled });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const enable = body.enable as boolean | undefined;

  if (typeof enable !== "boolean") {
    return NextResponse.json(
      { error: "enable (boolean) required" },
      { status: 400 }
    );
  }

  if (enable) {
    enableMarketplace();
    return NextResponse.json({
      success: true,
      marketplaceEnabled: true,
      message: "Marketplace enabled",
    });
  } else {
    const { listingsRemoved, buyOrdersRemoved } = disableMarketplace();
    return NextResponse.json({
      success: true,
      marketplaceEnabled: false,
      listingsRemoved,
      buyOrdersRemoved,
      message: `Marketplace disabled. ${listingsRemoved} listing(s) returned to owners, ${buyOrdersRemoved} buy order(s) cancelled.`,
    });
  }
}
