import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function proxy(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname=request.nextUrl.pathname;const doctorRoute=pathname.startsWith("/doctor");const loginPath=doctorRoute?"/doctor/login":"/admin/login";
  if(!url||!anonKey)return pathname===loginPath?NextResponse.next({request}):NextResponse.redirect(new URL(loginPath,request.url));

  let response=NextResponse.next({request});
  const supabase=createServerClient<Database>(url,anonKey,{cookies:{
    getAll(){return request.cookies.getAll()},
    setAll(cookiesToSet){
      cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
      response=NextResponse.next({request});
      cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
    },
  }});
  const{data:{user}}=await supabase.auth.getUser();
  const isAdmin=user?.app_metadata?.role==="admin";
  const isLogin=pathname===loginPath;const isNoAccess=pathname==="/doctor/no-access";
  let isDoctor=false;
  if(doctorRoute&&user){const{data}=await supabase.from("doctor_accounts").select("doctor_id").eq("user_id",user.id).maybeSingle();isDoctor=Boolean(data)}
  const destination=doctorRoute
    ?!user&&!isLogin?"/doctor/login":user&&!isDoctor&&!isNoAccess?"/doctor/no-access":isDoctor&&(isLogin||isNoAccess)?"/doctor":null
    :!user&&!isLogin?"/admin/login":user&&!isAdmin&&!isLogin?"/doctor/no-access":isAdmin&&isLogin?"/admin":null;
  if(!destination)return response;

  const redirectResponse=NextResponse.redirect(new URL(destination,request.url));
  response.cookies.getAll().forEach(cookie=>redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export const config={matcher:["/admin/:path*","/doctor/:path*"]};
