import type { Metadata } from "next";
import "./globals.css";
import { ScrollingWinnersBg } from "@/components/ScrollingWinnersBg";
import { AppWithFriends } from "@/components/AppWithFriends";
import { Footer } from "@/components/Footer";
import { FeedbackButton } from "@/components/FeedbackButton";
import Header from "@/components/Header";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Dabys.org",
  description: "Weekly movie submissions, voting, and winners",
  icons: {
    icon: "/icon-192.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#8b5cf6" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <PwaRegister />
        <AppWithFriends>
          <ScrollRestoration />
          <ScrollingWinnersBg />
          <Header />
          {children}
          <Footer />
          <FeedbackButton />
        </AppWithFriends>
      </body>
    </html>
  );
}
