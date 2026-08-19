import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { validHours } from "@/lib/schedule-validation";
import { isIsoDate,isUuid,mutationOriginError,safeServerError } from "@/lib/api-security";

type ExceptionType="day_off"|"custom_hours";
function mapException(row:{id:string;doctor_id:string;date:string;type:ExceptionType;start_time:string|null;end_time:string|null;break_start:string|null;break_end:string|null}){return{id:row.id,doctorId:row.doctor_id,date:row.date,type:row.type,startTime:row.start_time?.slice(0,5)??null,endTime:row.end_time?.slice(0,5)??null,breakStart:row.break_start?.slice(0,5)??null,breakEnd:row.break_end?.slice(0,5)??null}}

export async function GET(request:Request){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const doctorId=new URL(request.url).searchParams.get("doctorId");if(!isUuid(doctorId))return Response.json({error:"Выберите специалиста."},{status:400});
  const{data,error}=await auth.supabase.from("schedule_exceptions").select("*").eq("doctor_id",doctorId).order("date");if(error){safeServerError("api/admin/schedule-exceptions GET",error);return Response.json({error:"Не удалось загрузить исключения."},{status:500})}
  return Response.json({exceptions:(data??[]).map(mapException)});
}

export async function POST(request:Request){
  const originError=mutationOriginError(request);if(originError)return originError;
  const auth=await requireAdminApi();if("response" in auth)return auth.response;let body:{doctorId?:string;date?:string;type?:ExceptionType;startTime?:string|null;endTime?:string|null;breakStart?:string|null;breakEnd?:string|null};try{body=await request.json()}catch{return Response.json({error:"Проверьте дату и часы исключения."},{status:400})}
  const custom=body.type==="custom_hours";if(!isUuid(body.doctorId)||!isIsoDate(body.date)||!body.type||!(["day_off","custom_hours"] as string[]).includes(body.type)||custom&&!validHours({active:true,startTime:body.startTime,endTime:body.endTime,breakStart:body.breakStart,breakEnd:body.breakEnd}))return Response.json({error:"Проверьте дату и часы исключения."},{status:400});
  const row={doctor_id:body.doctorId,date:body.date,type:body.type,start_time:custom?body.startTime:null,end_time:custom?body.endTime:null,break_start:custom&&body.breakStart?body.breakStart:null,break_end:custom&&body.breakEnd?body.breakEnd:null};
  const{data,error}=await auth.supabase.from("schedule_exceptions").upsert(row,{onConflict:"doctor_id,date"}).select().single();if(error){safeServerError("api/admin/schedule-exceptions POST",error);return Response.json({error:"Не удалось сохранить исключение."},{status:500})}
  return Response.json({exception:mapException(data)},{status:201});
}
