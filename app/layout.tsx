import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GovernanceBanner } from "@/components/governance-banner";
import { Header } from "@/components/header";
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <GovernanceBanner />
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
