import { redirect } from "next/navigation";
import { DoctorDashboard } from "@/components/doctor/doctor-dashboard";
import { getDoctorAccess } from "@/lib/supabase/doctor-auth";

export const metadata={title:"Кабинет врача — Dream Smile"};

export default async function DoctorPage(){const{user,doctor}=await getDoctorAccess();if(!user)redirect("/doctor/login");if(!doctor)redirect("/doctor/no-access");return <DoctorDashboard doctor={doctor}/>}
