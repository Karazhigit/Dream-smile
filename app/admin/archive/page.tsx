import { ArchiveScreen } from "@/components/admin/archive-screen";
import { clinicConfig } from "@/lib/clinic-config";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { redirect } from "next/navigation";

export const metadata={title:`Архив записей — ${clinicConfig.name}`};
export default async function ArchivePage(){const{user}=await getAdminUser();if(!user)redirect("/admin/login");return <ArchiveScreen/>}
