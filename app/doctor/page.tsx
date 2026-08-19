import { redirect } from "next/navigation";
import { DoctorDashboard } from "@/components/doctor/doctor-dashboard";
import { getDoctorAccess } from "@/lib/supabase/doctor-auth";
import { clinicConfig } from "@/lib/clinic-config";

export const metadata={title:`Кабинет врача — ${clinicConfig.name}`};

export default async function DoctorPage(){const{user,doctor}=await getDoctorAccess();if(!user)redirect("/doctor/login");if(!doctor)redirect("/doctor/no-access");return <DoctorDashboard doctor={doctor}/>}
