import { type NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, clientId, action } = await request.json();

    if (!sessionId || !clientId || !action) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Use private channel for voice communication
    const channelName = `private-voice-${sessionId}`;

    if (action === "join") {
      // Trigger event to notify other clients that a user has joined
      await pusherServer.trigger(channelName, "voice-user-joined", {
        clientId,
        timestamp: new Date().toISOString(),
      });

      console.log(`User ${clientId} joined voice chat in session ${sessionId}`);
    } else if (action === "leave") {
      // Trigger event to notify other clients that a user has left
      await pusherServer.trigger(channelName, "voice-user-left", {
        clientId,
        timestamp: new Date().toISOString(),
      });

      console.log(`User ${clientId} left voice chat in session ${sessionId}`);
    } else if (action === "heartbeat") {
      // Just a heartbeat to keep the connection alive
      // No need to broadcast this to other clients
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Voice presence error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
