import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { pusherServer } from "@/lib/pusher";

// Cache TTL in seconds (60 seconds)
const PRESENCE_TTL = 60;

// Mark this route as dynamic to prevent static generation
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// This endpoint can be called by a cron job to clean up stale connections
export async function GET() {
  try {
    // Get all session presence patterns
    const sessionPatterns = await redis.keys("presence:*");
    const sessionIds = new Set<string>();

    // Extract unique session IDs
    for (const pattern of sessionPatterns) {
      const parts = pattern.split(":");
      if (parts.length >= 2) {
        sessionIds.add(parts[1]);
      }
    }

    // Process each session
    for (const sessionId of Array.from(sessionIds)) {
      const clientPattern = `presence:${sessionId}:*`;
      const clientKeys = await redis.keys(clientPattern);

      let activeCount = 0;

      // Process each client in this session
      for (const key of clientKeys) {
        const lastSeen = await redis.get(key);
        if (lastSeen) {
          const timeSinceLastSeen =
            Date.now() - Number.parseInt(lastSeen as string);
          if (timeSinceLastSeen > PRESENCE_TTL * 1000) {
            // Client is stale, remove it
            await redis.del(key);
          } else {
            activeCount++;
          }
        }
      }

      // Broadcast the updated count to all clients
      if (clientKeys.length > 0) {
        await pusherServer.trigger(`session-${sessionId}`, "presence-update", {
          count: activeCount,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Cleanup completed successfully",
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    return NextResponse.json(
      { error: "Failed to clean up stale connections" },
      { status: 500 }
    );
  }
}
