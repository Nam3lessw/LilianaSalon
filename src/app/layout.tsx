import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import WhatsAppButton from "@/components/WhatsAppButton";
import { AuthProvider } from "@/context/AuthContext";
import { CountryProvider } from "@/context/CountryContext";
import CustomerAuthModal from "@/components/CustomerAuthModal";
import CustomerRewardsModal from "@/components/CustomerRewardsModal";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Liliana Salon | Cuidado Capilar Profesional (Guatemala & El Salvador)",
  description: "Tratamientos profesionales de Keratech e IvoGa en Guatemala y El Salvador. Alisados orgánicos, nutrición y brillo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen bg-[#FFFDFB] text-gray-900 flex flex-col antialiased`}>
        <AuthProvider>
          <CountryProvider>
            <CartProvider>
              <Navbar />
              <main className="flex-grow">
                {children}
              </main>
              <WhatsAppButton />
              <CustomerAuthModal />
              <CustomerRewardsModal />
              <CartDrawer />
            </CartProvider>
          </CountryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
