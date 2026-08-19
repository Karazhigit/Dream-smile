import { requireAdminApi } from "@/lib/supabase/admin-auth";

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{id}=await params;if(!id)return Response.json({error:"Некорректный идентификатор."},{status:400});
  const{error}=await auth.supabase.from("schedule_exceptions").delete().eq("id",id);if(error){console.error("[api/admin/schedule-exceptions DELETE] Supabase delete failed",error);return Response.json({error:"Не удалось удалить исключение."},{status:500})}
  return Response.json({ok:true});
}
