import { type NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const socketId = formData.get("socket_id") as string;
    const channel = formData.get("channel_name") as string;

    console.log(`Authorizing channel: ${channel} for socket: ${socketId}`);

    // For private channels (including voice channels)
    if (channel.startsWith("private-")) {
      const authResponse = pusherServer.authorizeChannel(socketId, channel);
      console.log("Auth response:", authResponse);
      return NextResponse.json(authResponse);
    }

    // For presence channels
    if (channel.startsWith("presence-")) {
      const authResponse = pusherServer.authorizeChannel(socketId, channel, {
        user_id: socketId,
        user_info: {},
      });
      console.log("Presence auth response:", authResponse);
      return NextResponse.json(authResponse);
    }

    console.log("Unauthorized channel type:", channel);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch (error) {
    console.error("Pusher auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
