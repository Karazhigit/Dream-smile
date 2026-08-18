import type { AppointmentStatus } from "./database";
export interface Service { id:string; name:string; durationMinutes:number|null; active:boolean; createdAt:string; }
export interface Doctor { id:string; name:string|null; specialty:string; active:boolean; createdAt:string; }
export interface Availability { id:string; doctorId:string; date:string; startTime:string; endTime:string; available:boolean; }
export interface Appointment { id:string; patientName:string; patientPhone:string; comment:string|null; serviceId:string; doctorId:string; appointmentDate:string; appointmentTime:string; status:AppointmentStatus; createdAt:string; service?:Pick<Service,"id"|"name">|null; doctor?:Pick<Doctor,"id"|"name"|"specialty">|null; }
export interface BookingSlot { time:string; doctorId:string; }
