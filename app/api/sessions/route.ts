import { NextResponse } from "next/server";
import { nanoid } from "@/lib/nanoid";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { pusherServer } from "@/lib/pusher";


// Mark this route as dynamic to prevent static generation
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 60 * 60;

// Create a new session
export async function POST(request: Request) {
  try {
    const { language, code, input } = await request.json();

    // Generate a unique ID for this session
    const sessionId = nanoid();

    // Store the session data in MongoDB using Prisma
    await prisma.session.create({
      data: {
        id: sessionId,
        language,
        code,
        input,
      },
    });

    // Also cache in Redis for faster access
    await redis.set(
      `session:${sessionId}`,
      { language, code, input },
      { ex: CACHE_TTL }
    );

    // Clean up old sessions (older than 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    await prisma.session.deleteMany({
      where: {
        createdAt: {
          lt: oneWeekAgo,
        },
      },
    });

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// Get a session by ID
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Try to get session from Redis cache first
    let session = await redis.get(`session:${sessionId}`);

    // If not in cache, get from MongoDB
    if (!session) {
      const dbSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!dbSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Format the session data
      session = {
        language: dbSession.language,
        code: dbSession.code,
        input: dbSession.input,
      };

      // Cache the result in Redis
      await redis.set(`session:${sessionId}`, session, { ex: CACHE_TTL });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error retrieving session:", error);
    return NextResponse.json(
      { error: "Failed to retrieve session" },
      { status: 500 }
    );
  }
}

// Update a session
export async function PUT(request: Request) {
  try {
    const { sessionId, language, code, input, source } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Update the session in MongoDB
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        language,
        code,
        input,
      },
    });

    // Update the cache in Redis
    await redis.set(
      `session:${sessionId}`,
      { language, code, input },
      { ex: CACHE_TTL }
    );

    // Broadcast the changes to all connected clients
    await pusherServer.trigger(`session-${sessionId}`, "code-updated", {
      language,
      code,
      input,
      source, // Include the source client ID to prevent echo
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}
