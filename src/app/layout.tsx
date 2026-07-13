import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/lib/finance/session-context";
import { PrivacyProvider } from "@/lib/finance/privacy-context";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Финансовый помощник",
  description: "Telegram Mini App для планирования бюджета",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SessionProvider>
          <PrivacyProvider>
            <div className="flex-1 flex flex-col">{children}</div>
            <BottomNav />
          </PrivacyProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
