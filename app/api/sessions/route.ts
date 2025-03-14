import { NextResponse } from "next/server";
import { nanoid } from "@/lib/nanoid";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { pusherServer } from "@/lib/pusher";

// Mark this route as dynamic to prevent static generation
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 60 * 60;

// Define types for session data
interface SessionData {
  language: string;
  code: string;
  input: string;
}

interface PendingUpdate extends SessionData {
  timestamp: number;
}

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
    let session = (await redis.get(
      `session:${sessionId}`
    )) as SessionData | null;

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

    // Check if session exists in Redis cache first
    const cachedSession = (await redis.get(
      `session:${sessionId}`
    )) as SessionData | null;

    if (!cachedSession) {
      // Only check the database if not in cache
      const existingSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
    }

    const pendingUpdateData: PendingUpdate = {
      language,
      code,
      input,
      timestamp: Date.now(),
    };

    // Use debounced updates for database writes
    // Store pending update in Redis with short TTL
    await redis.set(
      `session:${sessionId}:pending`,
      pendingUpdateData,
      { ex: 30 } // 30 seconds TTL for pending updates
    );

    // Update the cache in Redis immediately for fast reads
    const sessionData: SessionData = { language, code, input };
    await redis.set(`session:${sessionId}`, sessionData, { ex: CACHE_TTL });

    // Broadcast the changes to all connected clients immediately
    await pusherServer.trigger(`session-${sessionId}`, "code-updated", {
      language,
      code,
      input,
      source, // Include the source client ID to prevent echo
    });

    // Use a background worker or scheduled task to process pending updates
    // This example uses a simple approach without a worker
    const isPrimaryWrite = await redis.set(
      `session:${sessionId}:lock`,
      "1",
      { ex: 5, nx: true } // 5 second lock, only set if not exists
    );

    if (isPrimaryWrite) {
      // This client got the lock, so it will perform the write
      // Wait a short time to allow for batching of rapid updates
      setTimeout(async () => {
        try {
          // Get the latest pending update
          const pendingUpdate = (await redis.get(
            `session:${sessionId}:pending`
          )) as PendingUpdate | null;

          if (pendingUpdate) {
            // Write to database only if there's a pending update
            await prisma.session.update({
              where: { id: sessionId },
              data: {
                language: pendingUpdate.language,
                code: pendingUpdate.code,
                input: pendingUpdate.input,
                updatedAt: new Date(), // Update the timestamp
              },
            });

            // Clear the pending update
            await redis.del(`session:${sessionId}:pending`);
          }

          // Release the lock (it would expire anyway, but this is cleaner)
          await redis.del(`session:${sessionId}:lock`);
        } catch (dbError) {
          console.error("Background DB update failed:", dbError);
          // The lock will expire automatically
        }
      }, 2000); // Wait 2 seconds to batch updates
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}
