import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import type React from "react";

export const metadata: Metadata = {
  viewport: "width=device-width, initial-scale=1.0",
  themeColor: "#000",
  title: "X - Code Compiler",
  description: "Compile and run code online with shareable links",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://x-codecompiler.vercel.app",
    title: "X - Code Compiler",
    description: "Compile and run code online with shareable links",
    siteName: "X - Code Compiler",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "X - Code Compiler",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "X - Code Compiler",
    description: "Compile and run code online with shareable links",
    images: ["/og-image.png"],
    creator: "@yourusername",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
