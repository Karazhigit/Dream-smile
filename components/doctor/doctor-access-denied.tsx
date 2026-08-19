"use client";

import { useRouter } from "next/navigation";
import { createSupabaseAuthBrowserClient } from "@/lib/supabase/auth-browser";

export function DoctorAccessDenied(){const router=useRouter();async function logout(){const supabase=createSupabaseAuthBrowserClient();if(supabase)await supabase.auth.signOut();router.replace("/doctor/login");router.refresh()}return <main className="grid min-h-screen place-items-center bg-background p-4"><section className="w-full max-w-lg rounded-[28px] border border-line bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,78,85,.1)]"><p className="font-serif text-3xl text-primary-dark">Dream Smile</p><h1 className="mt-8 font-serif text-4xl">Нет доступа</h1><p className="mt-4 text-sm leading-6 text-muted">Этот Auth-пользователь не привязан к профилю врача.</p><button type="button" onClick={()=>{void logout()}} className="btn-primary mt-7">Войти другим аккаунтом</button></section></main>}
