import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { isUuid,mutationOriginError,safeServerError } from "@/lib/api-security";

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  const originError=mutationOriginError(request);if(originError)return originError;
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{id}=await params;if(!isUuid(id))return Response.json({error:"Некорректный идентификатор."},{status:400});
  const{error}=await auth.supabase.from("schedule_exceptions").delete().eq("id",id);if(error){safeServerError("api/admin/schedule-exceptions DELETE",error);return Response.json({error:"Не удалось удалить исключение."},{status:500})}
  return Response.json({ok:true});
}
