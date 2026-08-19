import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { clinicConfig } from "@/lib/clinic-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: `${clinicConfig.name} — стоматология в ${clinicConfig.city}`,
  description: `Современная стоматология ${clinicConfig.name} в городе ${clinicConfig.city}. Диагностика, лечение и удобная онлайн-запись.`,
  alternates:{canonical:"/"},
  openGraph:{
    type:"website",
    url:"/",
    siteName:clinicConfig.name,
    title:`${clinicConfig.name} — стоматология в ${clinicConfig.city}`,
    description:`Современная стоматология ${clinicConfig.name} в городе ${clinicConfig.city}. Диагностика, лечение и удобная онлайн-запись.`,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru"><body>{children}</body></html>;
}
