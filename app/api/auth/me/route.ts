import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({
      success: true,
      user,
      isAuthenticated: !!user,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        user: null,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : "Failed to get user session",
      },
      { status: 500 }
    );
  }
}
