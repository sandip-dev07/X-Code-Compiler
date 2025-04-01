"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CodeCompiler from "@/components/code-compiler";
import { Loader2 } from "lucide-react";
import Image from "next/image";

interface SessionPageProps {
  params: {
    sessionId: string;
  };
}

export default function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = params;
  const router = useRouter();
  const [sessionData, setSessionData] = useState<{
    language: string;
    code: string;
    input: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch(`/api/sessions?id=${sessionId}`);

        if (!response.ok) {
          if (response.status === 404) {
            // If session not found, redirect to home page
            router.push("/");
            return;
          }
          throw new Error(`Failed to fetch session: ${response.statusText}`);
        }

        const data = await response.json();
        setSessionData(data);
      } catch (err) {
        console.error("Error fetching session:", err);
        setError("Failed to load editor session. Redirecting to home page...");

        // Redirect to home page after a short delay
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full"></div>
              <Loader2
                strokeWidth={0.8}
                className="absolute w-14 h-14 text-[#73DC8C] animate-spin"
              />
            </div>
            <div className="rounded-full overflow-hidden border-2 border-transparent p-2 z-10 relative">
              <Image
                src="/apple-touch-icon.png"
                width={30}
                height={30}
                alt="Logo"
                className="rounded-full z-20"
              />
            </div>
          </div>
          <p className="mt-4 text-muted-foreground">Loading editor session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return null;
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-black">
      <CodeCompiler
        initialLanguage={sessionData.language}
        initialCode={sessionData.code}
        initialInput={sessionData.input}
        sessionId={sessionId}
      />
    </div>
  );
}
