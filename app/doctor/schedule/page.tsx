import { redirect } from "next/navigation";
import { DoctorSchedule } from "@/components/doctor/doctor-schedule";
import { getDoctorAccess } from "@/lib/supabase/doctor-auth";

export const metadata={title:"Расписание врача — Dream Smile"};

export default async function DoctorSchedulePage(){const{user,doctor}=await getDoctorAccess();if(!user)redirect("/doctor/login");if(!doctor)redirect("/doctor/no-access");return <DoctorSchedule doctor={doctor}/>}
