import { AdminDashboard } from "@/components/admin/admin-dashboard";
export const metadata={title:"Админ-панель — Dream Smile"};
const sections=["appointments","calendar","services","doctors","schedule"] as const;
export default async function AdminPage({searchParams}:{searchParams:Promise<{screen?:string|string[]}>}){const value=(await searchParams).screen;const requested=typeof value==="string"?value:"appointments";const initialScreen=sections.find(section=>section===requested)??"appointments";return <AdminDashboard initialScreen={initialScreen}/>}
