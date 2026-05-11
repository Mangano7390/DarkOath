import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HoReCa AI",
  description: "Plateforme IA interne pour distribution HoReCa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
