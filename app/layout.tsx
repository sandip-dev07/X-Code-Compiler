import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import type React from "react";

export const metadata: Metadata = {
  title: "X - Code Compiler",
  description: "Compile and run code online with shareable links",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
    other: [
      {
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://x-codecompiler.vercel.app/",
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
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
