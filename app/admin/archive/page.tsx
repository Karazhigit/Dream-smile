import { ArchiveScreen } from "@/components/admin/archive-screen";
import { clinicConfig } from "@/lib/clinic-config";

export const metadata={title:`Архив записей — ${clinicConfig.name}`};
export default function ArchivePage(){return <ArchiveScreen/>}
