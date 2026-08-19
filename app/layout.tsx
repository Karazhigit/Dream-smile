import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { clinicConfig } from "@/lib/clinic-config";
import "./globals.css";

const siteTitle="Dream Smile — стоматология в Жезказгане";
const siteDescription="Современная стоматология Dream Smile в Жезказгане. Диагностика, лечение зубов, лечение кариеса, хирургическая и неотложная стоматология. Онлайн-запись на приём.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: siteTitle,
  description: siteDescription,
  alternates:{canonical:"/"},
  robots:{index:true,follow:true},
  openGraph:{
    type:"website",
    url:"/",
    locale:"ru_KZ",
    siteName:clinicConfig.name,
    title:siteTitle,
    description:siteDescription,
    images:[{url:"/opengraph-image.png",width:1200,height:630,alt:`${clinicConfig.name} — современная стоматология в Жезказгане`}],
  },
  twitter:{card:"summary_large_image",title:siteTitle,description:siteDescription,images:["/opengraph-image.png"]},
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru"><body>{children}</body></html>;
}
