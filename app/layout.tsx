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
          {/* Governance banner spans full width */}
          <GovernanceBanner />

          {/* Body: sidebar + main */}
          <div className="flex flex-1 min-h-0">
            <Sidebar />

            {/* Main content area */}
            <div className="flex flex-1 flex-col min-w-0">
              <main className="flex-1 p-6 lg:p-8 max-w-screen-2xl w-full">
                {children}
              </main>
            </div>
          </div>
        </div>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
