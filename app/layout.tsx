import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileTopBar } from "@/components/MobileTopBar";
import { LockScreen } from "@/components/LockScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { prisma } from "@/lib/db";
import { lockState } from "@/lib/lock";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Insurance CRM",
  description: "AI-powered CRM for an insurance agent",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, lock] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    lockState(),
  ]);

  const paletteClients = lock === "locked"
    ? []
    : (await prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }));

  if (lock === "locked") {
    return (
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <body className="font-sans" suppressHydrationWarning>
          <LockScreen />
        </body>
      </html>
    );
  }

  const social = { linkedin: settings?.myLinkedin ?? null, instagram: settings?.myInstagram ?? null, youtube: settings?.myYoutube ?? null };
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <ToastProvider>
          <CommandPalette clients={paletteClients} />
          <div className="flex min-h-screen">
            <Sidebar social={social} />
            <div className="flex-1 md:ml-60">
              <MobileTopBar />
              <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 md:px-8 md:py-7">{children}</main>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
