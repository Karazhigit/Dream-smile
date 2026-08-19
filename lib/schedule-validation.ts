export type ScheduleHours={active:boolean;startTime?:string|null;endTime?:string|null;breakStart?:string|null;breakEnd?:string|null};

const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function validTime(value:unknown):value is string{return typeof value==="string"&&timePattern.test(value)}
export function validHours(value:ScheduleHours){
  if(!value.active)return true;
  if(!validTime(value.startTime)||!validTime(value.endTime)||value.startTime>=value.endTime)return false;
  const hasBreakStart=Boolean(value.breakStart);const hasBreakEnd=Boolean(value.breakEnd);if(hasBreakStart!==hasBreakEnd)return false;
  return !hasBreakStart||(validTime(value.breakStart)&&validTime(value.breakEnd)&&value.startTime<=value.breakStart&&value.breakStart<value.breakEnd&&value.breakEnd<=value.endTime);
}
