import type { Metadata } from "next";
import { BookingProvider } from "@/components/booking-flow/context";
import { BookingShell } from "@/components/booking-flow/shell";
import { clinicConfig } from "@/lib/clinic-config";

export const metadata:Metadata={title:`Онлайн-запись — ${clinicConfig.name}`};
export default function BookingLayout({children}:{children:React.ReactNode}){return <BookingProvider><BookingShell>{children}</BookingShell></BookingProvider>}
