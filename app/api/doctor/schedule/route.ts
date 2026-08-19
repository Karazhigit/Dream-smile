import { requireDoctorApi } from "@/lib/supabase/doctor-auth";
import { clinicToday } from "@/lib/clinic-date";
import { safeServerError } from "@/lib/api-security";

function mapSchedule(row:{id:string;doctor_id:string;weekday:number;start_time:string|null;end_time:string|null;break_start:string|null;break_end:string|null;active:boolean}){return{id:row.id,doctorId:row.doctor_id,weekday:row.weekday,startTime:row.start_time?.slice(0,5)??null,endTime:row.end_time?.slice(0,5)??null,breakStart:row.break_start?.slice(0,5)??null,breakEnd:row.break_end?.slice(0,5)??null,active:row.active}}
function mapException(row:{id:string;doctor_id:string;date:string;type:"day_off"|"custom_hours";start_time:string|null;end_time:string|null;break_start:string|null;break_end:string|null}){return{id:row.id,doctorId:row.doctor_id,date:row.date,type:row.type,startTime:row.start_time?.slice(0,5)??null,endTime:row.end_time?.slice(0,5)??null,breakStart:row.break_start?.slice(0,5)??null,breakEnd:row.break_end?.slice(0,5)??null}}

export async function GET(request:Request){
  const auth=await requireDoctorApi();if("response" in auth)return auth.response;const{supabase,doctor}=auth;
  const requestedDoctorId=new URL(request.url).searchParams.get("doctorId");if(requestedDoctorId&&requestedDoctorId!==doctor.id)return Response.json({error:"Нет доступа к расписанию другого врача."},{status:403});
  const[schedulesResult,exceptionsResult]=await Promise.all([supabase.from("doctor_schedules").select("*").eq("doctor_id",doctor.id).order("weekday"),supabase.from("schedule_exceptions").select("*").eq("doctor_id",doctor.id).gte("date",clinicToday()).order("date")]);
  if(schedulesResult.error||exceptionsResult.error){if(schedulesResult.error)safeServerError("api/doctor/schedule schedules",schedulesResult.error);if(exceptionsResult.error)safeServerError("api/doctor/schedule exceptions",exceptionsResult.error);return Response.json({error:"Не удалось загрузить расписание."},{status:500})}
  return Response.json({schedules:(schedulesResult.data??[]).map(mapSchedule),exceptions:(exceptionsResult.data??[]).map(mapException)},{headers:{"Cache-Control":"no-store, max-age=0"}});
}
