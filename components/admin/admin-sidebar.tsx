"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

export type AdminSection="appointments"|"calendar"|"services"|"doctors"|"schedule";
type AdminNavId=AdminSection|"archive";
const items:[AdminSection,string][]=[["appointments","Записи"],["calendar","Календарь"],["services","Услуги"],["doctors","Специалисты"],["schedule","Расписание"]];
const hrefs:Record<AdminSection,string>={appointments:"/admin",calendar:"/admin?screen=calendar",services:"/admin?screen=services",doctors:"/admin?screen=doctors",schedule:"/admin?screen=schedule"};

export function AdminSidebar({active,onSelect}:{active:AdminNavId;onSelect?:(section:AdminSection)=>void}){
  const router=useRouter();const[signingOut,setSigningOut]=useState(false);const itemClass=(id:AdminNavId)=>`min-h-11 shrink-0 rounded-xl px-4 text-left text-sm font-bold lg:w-full ${active===id?"bg-white text-primary-dark":"text-white/65 hover:bg-white/10"}`;
  async function logout(){if(signingOut)return;setSigningOut(true);const supabase=createSupabaseAuthBrowserClient();if(supabase)await supabase.auth.signOut();router.replace("/admin/login")}
  return <aside className="border-b border-line bg-primary-dark p-5 text-white lg:min-h-screen lg:border-b-0 lg:p-7"><div className="flex items-center justify-between lg:block"><div><p className="font-serif text-2xl">Dream Smile</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[.2em] text-secondary">Админ-панель</p></div><Link href="/" className="rounded-full border border-white/20 px-3 py-2 text-xs font-bold lg:mt-8 lg:inline-block">На сайт</Link></div><nav className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:mt-12 lg:block lg:space-y-2">{items.map(([id,label])=>onSelect?<button key={id} type="button" onClick={()=>onSelect(id)} className={itemClass(id)}>{label}</button>:<Link key={id} href={hrefs[id]} className={`inline-flex items-center ${itemClass(id)}`}>{label}</Link>)}<Link href="/admin/archive" className={`inline-flex items-center ${itemClass("archive")}`}>Архив</Link><button type="button" disabled={signingOut} onClick={()=>{void logout()}} className={itemClass("appointments").replace(active==="appointments"?"bg-white text-primary-dark":"text-white/65 hover:bg-white/10","text-white/65 hover:bg-white/10 disabled:opacity-50")}>{signingOut?"Выходим…":"Выйти"}</button></nav></aside>
}
