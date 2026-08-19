import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminUser } from "@/lib/supabase/admin-auth";

export const metadata={title:"Вход в админ-панель — Dream Smile"};

export default async function AdminLoginPage(){
  const{user}=await getAdminUser();
  if(user)redirect("/admin");
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f6f8f8] px-4 py-10"><div aria-hidden className="absolute -left-24 top-[-100px] h-80 w-80 rounded-full bg-secondary/70 blur-3xl"/><div aria-hidden className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-[#efe5d3]/70 blur-3xl"/><section className="relative w-full max-w-[460px] rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_28px_90px_rgba(15,78,85,.12)] sm:p-10"><div className="mb-9 text-center"><p className="font-serif text-3xl text-primary-dark">Dream Smile</p><p className="mt-2 text-[10px] font-extrabold uppercase tracking-[.24em] text-accent">Стоматология</p></div><div className="mb-7"><p className="eyebrow">Для сотрудников</p><h1 className="mt-3 font-serif text-[36px] leading-[1.05] tracking-[-.03em] text-ink">Вход в админ-панель</h1><p className="mt-3 text-sm leading-6 text-muted">Введите данные аккаунта администратора.</p></div><AdminLoginForm/></section></main>;
}
