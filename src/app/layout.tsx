import type { Metadata } from "next";
import "./globals.css";
import { ScrollingWinnersBg } from "@/components/ScrollingWinnersBg";
import { AppWithFriends } from "@/components/AppWithFriends";
import { Footer } from "@/components/Footer";
import { FeedbackButton } from "@/components/FeedbackButton";

export const metadata: Metadata = {
  title: "Dabys.org",
  description: "Weekly movie submissions, voting, and winners",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <AppWithFriends>
          <ScrollingWinnersBg />
          {children}
          <Footer />
          <FeedbackButton />
        </AppWithFriends>
      </body>
    </html>
  );
}
