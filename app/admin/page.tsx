import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { clinicConfig } from "@/lib/clinic-config";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { redirect } from "next/navigation";
export const metadata={title:`Админ-панель — ${clinicConfig.name}`};
const sections=["appointments","calendar","services","doctors","schedule"] as const;
export default async function AdminPage({searchParams}:{searchParams:Promise<{screen?:string|string[]}>}){const[{user},params]=await Promise.all([getAdminUser(),searchParams]);if(!user)redirect("/admin/login");const value=params.screen;const requested=typeof value==="string"?value:"appointments";const initialScreen=sections.find(section=>section===requested)??"appointments";return <AdminDashboard initialScreen={initialScreen}/>}
