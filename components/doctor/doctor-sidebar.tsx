"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

export function DoctorSidebar({active}:{active:"appointments"|"schedule"}){
  const router=useRouter();const[signingOut,setSigningOut]=useState(false);const itemClass=(id:string)=>`motion-interactive inline-flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-bold lg:w-full ${active===id?"bg-white text-primary-dark":"text-white/70 hover:bg-white/10"}`;
  async function logout(){if(signingOut)return;setSigningOut(true);const supabase=createSupabaseAuthBrowserClient();if(supabase)await supabase.auth.signOut();router.replace("/doctor/login")}
  return <aside className="border-b border-line bg-primary-dark p-5 text-white lg:min-h-screen lg:border-b-0 lg:p-7"><div className="flex items-center justify-between lg:block"><div><p className="font-serif text-2xl">Dream Smile</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[.2em] text-secondary">Кабинет врача</p></div><Link href="/" className="rounded-full border border-white/20 px-3 py-2 text-xs font-bold lg:mt-8 lg:inline-block">На сайт</Link></div><nav className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:mt-12 lg:block lg:space-y-2"><Link href="/doctor" className={itemClass("appointments")}>Мои записи</Link><Link href="/doctor/schedule" className={itemClass("schedule")}>Расписание</Link><button type="button" disabled={signingOut} onClick={()=>{void logout()}} className="min-h-11 shrink-0 rounded-xl px-4 text-left text-sm font-bold text-white/70 hover:bg-white/10 disabled:opacity-50 lg:w-full">{signingOut?"Выходим…":"Выйти"}</button></nav></aside>;
}
