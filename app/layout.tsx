import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dream Smile — стоматология в Жезказгане",
  description: "Современная стоматология Dream Smile в Жезказгане. Диагностика, лечение и удобная онлайн-запись.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru"><body>{children}</body></html>;
}
