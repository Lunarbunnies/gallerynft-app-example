import { NextResponse } from "next/server";
import { fetchIndexedDashboard } from "../../../lib/indexedQueries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");

  try {
    return NextResponse.json(await fetchIndexedDashboard(owner));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load indexed dashboard" },
      { status: 500 }
    );
  }
}
