import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { pusherServer } from "@/lib/pusher";

// Mark this route as dynamic to prevent static generation
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Cache TTL in seconds (60 seconds)
const PRESENCE_TTL = 60;

export async function POST(request: Request) {
  try {
    const { sessionId, clientId, action } = await request.json();

    if (!sessionId || !clientId || !action) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const presenceKey = `presence:${sessionId}`;
    const clientKey = `presence:${sessionId}:${clientId}`;

    if (action === "join" || action === "heartbeat") {
      // Set this client as active with expiration
      await redis.set(clientKey, Date.now().toString(), {
        ex: PRESENCE_TTL,
      });
    } else if (action === "leave") {
      // Remove this client
      await redis.del(clientKey);
    }

    // Clean up stale clients (those that haven't sent a heartbeat)
    const clientPattern = `presence:${sessionId}:*`;
    const clientKeys = await redis.keys(clientPattern);

    // Count active clients
    let activeCount = 0;

    // Process each client
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
    await pusherServer.trigger(`session-${sessionId}`, "presence-update", {
      count: activeCount,
    });

    return NextResponse.json({
      success: true,
      count: activeCount,
    });
  } catch (error) {
    console.error("Error updating presence:", error);
    return NextResponse.json(
      { error: "Failed to update presence" },
      { status: 500 }
    );
  }
}
