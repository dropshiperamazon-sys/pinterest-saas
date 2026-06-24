import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SessionProvider from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "My Pin Pro - Pinterest Marketing Suite",
  description: "Keyword research, pin scheduler, and ads manager for Pinterest marketers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <SessionProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
