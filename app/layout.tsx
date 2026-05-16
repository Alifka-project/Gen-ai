import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GovernanceBanner } from "@/components/governance-banner";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ReturnGuard AI",
  description:
    "Multimodal RAG + human-in-the-loop decision support for product return validation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}
      >
        <div className="flex flex-col min-h-screen">
          <GovernanceBanner />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <div className="px-6 py-6 lg:px-8 lg:py-7 max-w-7xl w-full mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
