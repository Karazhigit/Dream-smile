import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { validHours, type ScheduleHours } from "@/lib/schedule-validation";
import { isUuid,mutationOriginError,safeServerError } from "@/lib/api-security";

type ScheduleInput=ScheduleHours&{weekday:number};
function mapSchedule(row:{id:string;doctor_id:string;weekday:number;start_time:string|null;end_time:string|null;break_start:string|null;break_end:string|null;active:boolean}){return{id:row.id,doctorId:row.doctor_id,weekday:row.weekday,startTime:row.start_time?.slice(0,5)??null,endTime:row.end_time?.slice(0,5)??null,breakStart:row.break_start?.slice(0,5)??null,breakEnd:row.break_end?.slice(0,5)??null,active:row.active}}

export async function GET(request:Request){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const doctorId=new URL(request.url).searchParams.get("doctorId");if(!isUuid(doctorId))return Response.json({error:"Выберите специалиста."},{status:400});
  const{data,error}=await auth.supabase.from("doctor_schedules").select("*").eq("doctor_id",doctorId).order("weekday");if(error){safeServerError("api/admin/schedules GET",error);return Response.json({error:"Не удалось загрузить расписание."},{status:500})}
  return Response.json({schedules:(data??[]).map(mapSchedule),saved:Boolean(data?.length)});
}

export async function PUT(request:Request){
  const originError=mutationOriginError(request);if(originError)return originError;
  const auth=await requireAdminApi();if("response" in auth)return auth.response;let body:{doctorId?:string;schedules?:ScheduleInput[]};try{body=await request.json()}catch{return Response.json({error:"Проверьте рабочие часы и обед."},{status:400})}
  if(!isUuid(body.doctorId)||!Array.isArray(body.schedules)||body.schedules.length!==7||new Set(body.schedules.map(row=>row.weekday)).size!==7||body.schedules.some(row=>!Number.isInteger(row.weekday)||row.weekday<0||row.weekday>6||!validHours(row)))return Response.json({error:"Проверьте рабочие часы и обед."},{status:400});
  const rows=body.schedules.map(row=>({doctor_id:body.doctorId!,weekday:row.weekday,active:row.active,start_time:row.active?row.startTime:null,end_time:row.active?row.endTime:null,break_start:row.active&&row.breakStart?row.breakStart:null,break_end:row.active&&row.breakEnd?row.breakEnd:null}));
  const{data,error}=await auth.supabase.from("doctor_schedules").upsert(rows,{onConflict:"doctor_id,weekday"}).select();if(error){safeServerError("api/admin/schedules PUT",error);return Response.json({error:"Не удалось сохранить расписание."},{status:500})}
  return Response.json({schedules:(data??[]).map(mapSchedule)});
}
