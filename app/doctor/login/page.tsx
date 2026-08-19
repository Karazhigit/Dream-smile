import { redirect } from "next/navigation";
import { DoctorLoginForm } from "@/components/doctor/doctor-login-form";
import { getDoctorAccess } from "@/lib/supabase/doctor-auth";

export const metadata={title:"Вход для врача — Dream Smile"};

export default async function DoctorLoginPage(){const{user,doctor}=await getDoctorAccess();if(doctor)redirect("/doctor");if(user)redirect("/doctor/no-access");return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f6f8f8] px-4 py-10"><div aria-hidden className="absolute -left-24 top-[-100px] h-80 w-80 rounded-full bg-secondary/70 blur-3xl"/><div aria-hidden className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-[#efe5d3]/70 blur-3xl"/><section className="relative w-full max-w-[460px] rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_28px_90px_rgba(15,78,85,.12)] sm:p-10"><div className="mb-9 text-center"><p className="font-serif text-3xl text-primary-dark">Dream Smile</p><p className="mt-2 text-[10px] font-extrabold uppercase tracking-[.24em] text-accent">Стоматология</p></div><p className="eyebrow">Для специалистов</p><h1 className="mt-3 font-serif text-[36px] leading-tight">Вход в кабинет врача</h1><p className="mt-3 text-sm leading-6 text-muted">Введите email и пароль аккаунта врача.</p><div className="mt-7"><DoctorLoginForm/></div></section></main>}
