import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Dream Smile — стоматология в Жезказгане",
  description: "Современная стоматология Dream Smile в Жезказгане. Диагностика, лечение и удобная онлайн-запись.",
  alternates:{canonical:"/"},
  openGraph:{
    type:"website",
    url:"/",
    siteName:"Dream Smile",
    title:"Dream Smile — стоматология в Жезказгане",
    description:"Современная стоматология Dream Smile в Жезказгане. Диагностика, лечение и удобная онлайн-запись.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru"><body>{children}</body></html>;
}
