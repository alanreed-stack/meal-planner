import { ViewTransition } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ServiceWorker } from "@/components/service-worker";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Meal Planner", template: "%s · Meal Planner" },
  description: "Plan the week's dinners and send the grocery list to Kroger.",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Meal Planner", statusBarStyle: "default" },
};

/** "light" or "dark" if that was picked in Settings, otherwise nothing (follow the phone). */
async function chosenTheme(): Promise<"light" | "dark" | undefined> {
  const v = (await cookies()).get("theme")?.value;
  return v === "light" || v === "dark" ? v : undefined;
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await chosenTheme();
  return {
    width: "device-width",
    initialScale: 1,
    colorScheme: theme ?? "light dark",
    // The browser bar takes the page color: the chosen theme's, or the phone's.
    themeColor: theme
      ? theme === "dark"
        ? "#0a0a0a"
        : "#ffffff"
      : [
          { media: "(prefers-color-scheme: light)", color: "#ffffff" },
          { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
        ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await chosenTheme();
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <ViewTransition>{children}</ViewTransition>
        </ToastProvider>
        <PullToRefresh />
        <ServiceWorker />
      </body>
    </html>
  );
}
