import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@/app/polyfills";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-montserrat",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coffee & Beats",
  description: "Autoatendimento Coffee & Beats",
  manifest: "/manifest-totem.json",
  icons: {
    icon:             "/favicon.ico",
    shortcut:         "/favicon.ico",
    apple:            "/apple-touch-icon.png",
    other: [
      { rel: "icon", type: "image/png", sizes: "32x32",  url: "/icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", url: "/favicon-192.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#3B2415" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="h-full antialiased">
        {children}
      </body>
    </html>
  );
}
