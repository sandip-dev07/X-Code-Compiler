import { Loader2 } from "lucide-react";
import Image from "next/image";
import React from "react";

const TestPage = () => {
  return (
    <div className="h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full"></div>
            <Loader2 strokeWidth={0.8} className="absolute w-14 h-14 text-[#73DC8C] animate-spin" />
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
};

export default TestPage;