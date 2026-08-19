const CLINIC_TIME_ZONE="Asia/Almaty";

function dateParts(now:Date){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:CLINIC_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return{year:Number(values.year),month:Number(values.month),day:Number(values.day)};
}

export function clinicDate(offsetDays=0,now=new Date()){
  const{year,month,day}=dateParts(now);const date=new Date(Date.UTC(year,month-1,day+offsetDays));return date.toISOString().slice(0,10);
}

export function clinicToday(now?:Date){return clinicDate(0,now)}
export function clinicTomorrow(now?:Date){return clinicDate(1,now)}
export function archiveCutoffDate(now?:Date){return clinicDate(-30,now)}
export function isArchivedAppointment(status:string,appointmentDate:string,now?:Date){return(status==="completed"||status==="cancelled")&&appointmentDate<archiveCutoffDate(now)}
