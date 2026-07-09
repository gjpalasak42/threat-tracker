import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderAuth } from "@/components/header-auth";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Threat Tracker - OSINT Investigation Hub",
  description: "A security operations center for threat intelligence with real-time feeds, IP investigation, and automated ingestion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${jetbrainsMono.variable} dark`}>
      <body className="antialiased">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 sm:px-6">
              <SidebarTrigger className="-ml-1" />
              <div className="hidden h-4 w-px bg-border sm:block" />
              <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                Security Operations Center
              </span>
              <div className="flex-1" />
              <HeaderAuth />
            </header>
            <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
