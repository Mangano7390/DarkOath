import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "Mr Horeca & Mr Electro", template: "%s — Mr Horeca & Mr Electro" },
  description:
    "Distribution professionnelle de matériel HoReCa et grand public d'électroménager / multimédia en Belgique.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
