"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();

  // Create a new session when the page loads
  useEffect(() => {
    async function createNewSession() {
      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            language: "cpp",
            code: `#include <iostream>

int main() {
  // Write C++ code here
  std::cout << "Welcome to Online Code Compiler!!";
  return 0;
}`,
            input: "",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create session");
        }

        const { sessionId } = await response.json();

        // Redirect to the session page
        router.push(`/${sessionId}`);
      } catch (error) {
        console.error("Error creating session:", error);
      }
    }

    createNewSession();
  }, [router]);

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

        <p className="mt-4 text-muted-foreground">Creating a new editor session...</p>
      </div>
    </div>
  );
}
