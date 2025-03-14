"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
        <Loader2 className="h-8 w-8 text-[#73DC8C] animate-spin" />
        <p className="mt-4 text-white">Creating a new editor session...</p>
      </div>
    </div>
  );
}
