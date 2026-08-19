import { DoctorAccessDenied } from "@/components/doctor/doctor-access-denied";
import { clinicConfig } from "@/lib/clinic-config";

export const metadata={title:`Нет доступа — ${clinicConfig.name}`};
export default function DoctorNoAccessPage(){return <DoctorAccessDenied/>}
