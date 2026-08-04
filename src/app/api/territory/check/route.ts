import { NextResponse } from "next/server";
import { checkTerritory } from "@/lib/territory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get("zip") ?? "";
  return NextResponse.json(checkTerritory(zip));
}
