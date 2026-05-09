import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { readThemeCookie } from "@/lib/theme-cookie";
import { cn } from "@/lib/utils";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const serif = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Libretto — your reading journal",
    template: "%s · Libretto",
  },
  description:
    "A small, humble place for the books you read — reviews, highlights, and ideas that resurface at the right time.",
  applicationName: "Libretto",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Libretto", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f1e3" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1612" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = await readThemeCookie();
  const isDark = theme.mode === "dark";

  return (
    <html
      lang="en"
      data-palette={theme.palette}
      data-type={theme.type}
      className={cn(sans.variable, serif.variable, "h-full antialiased", isDark && "dark")}
      style={{ colorScheme: isDark ? "dark" : "light" }}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
