import { createClient } from "@supabase/supabase-js";
import { loadEnvFile } from "node:process";

loadEnvFile(".env.local");

const adminEmail="alisherkarazhigit77@gmail.com";
const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

if(!supabaseUrl||!serviceRoleKey)throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

const supabase=createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
const perPage=1000;
let user;

for(let page=1;!user;page+=1){
  const{data,error}=await supabase.auth.admin.listUsers({page,perPage});
  if(error)throw new Error("Unable to list Supabase Auth users");
  user=data.users.find(candidate=>candidate.email?.toLowerCase()===adminEmail);
  if(user||data.users.length<perPage)break;
}

if(!user)throw new Error("Supabase Auth user not found");

const{error:updateError}=await supabase.auth.admin.updateUserById(user.id,{app_metadata:{...user.app_metadata,role:"admin"}});
if(updateError)throw new Error("Unable to assign admin role");

console.log("Admin role assigned successfully");
