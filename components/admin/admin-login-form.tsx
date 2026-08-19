"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

function authErrorMessage(message:string){
  const value=message.toLowerCase();
  if(value.includes("invalid login credentials"))return "Неверный email или пароль.";
  if(value.includes("email not confirmed"))return "Email администратора ещё не подтверждён.";
  if(value.includes("rate limit")||value.includes("too many"))return "Слишком много попыток. Попробуйте немного позже.";
  return "Не удалось войти. Проверьте данные и попробуйте ещё раз.";
}

export function AdminLoginForm(){
  const router=useRouter();const[loading,setLoading]=useState(false);const[error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");const form=new FormData(event.currentTarget);const email=String(form.get("email")||"").trim().toLowerCase();const password=String(form.get("password")||"");
    if(!/^\S+@\S+\.\S+$/.test(email)){setError("Введите корректный email.");return}if(password.length<6){setError("Пароль должен содержать не менее 6 символов.");return}
    const supabase=createSupabaseAuthBrowserClient();if(!supabase){setError("Supabase не подключён.");return}
    setLoading(true);
    try{
      const{error:signInError}=await supabase.auth.signInWithPassword({email,password});if(signInError){setError(authErrorMessage(signInError.message));return}
      const{data:{user},error:userError}=await supabase.auth.getUser();if(userError||user?.app_metadata?.role!=="admin"){await supabase.auth.signOut();setError("У этого аккаунта нет доступа к админ-панели.");return}
      router.replace("/admin");router.refresh();
    }catch{setError("Не удалось связаться с сервером. Попробуйте ещё раз.")}finally{setLoading(false)}
  }
  return <form onSubmit={submit} noValidate className="space-y-5"><label className="block"><span className="mb-2 block text-xs font-bold text-ink">Email</span><input name="email" type="email" inputMode="email" autoComplete="email" required disabled={loading} placeholder="admin@example.com" className="focus-ring h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none transition focus:border-primary disabled:opacity-60"/></label><label className="block"><span className="mb-2 block text-xs font-bold text-ink">Пароль</span><input name="password" type="password" autoComplete="current-password" required minLength={6} disabled={loading} placeholder="Введите пароль" className="focus-ring h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none transition focus:border-primary disabled:opacity-60"/></label>{error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-5 text-red-700">{error}</p>}<button type="submit" disabled={loading} className="btn-primary focus-ring w-full disabled:cursor-wait disabled:opacity-60">{loading?"Входим…":"Войти"}</button></form>;
}
