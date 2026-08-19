"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Doctor, Service } from "@/types";
import { getCatalog } from "@/lib/booking-client-cache";

export type BookingState={serviceId:string;doctorChoice:string;doctorId:string;date:string;time:string;completed:boolean;notice:string};
const initialState:BookingState={serviceId:"",doctorChoice:"",doctorId:"",date:"",time:"",completed:false,notice:""};
const storageKey="dream-smile-booking";

type BookingContextValue={state:BookingState;update:(patch:Partial<BookingState>)=>void;clear:()=>void;services:Service[];doctors:Doctor[];catalogLoading:boolean;catalogError:string;retryCatalog:()=>void;ready:boolean};
const BookingContext=createContext<BookingContextValue|null>(null);

function readState(){
  try{const saved=sessionStorage.getItem(storageKey);return saved?{...initialState,...JSON.parse(saved) as Partial<BookingState>}:initialState}catch{return initialState}
}

export function BookingProvider({children}:{children:React.ReactNode}){
  const[state,setState]=useState(initialState);const[ready,setReady]=useState(false);const[services,setServices]=useState<Service[]>([]);const[doctors,setDoctors]=useState<Doctor[]>([]);const[catalogLoading,setCatalogLoading]=useState(true);const[catalogError,setCatalogError]=useState("");
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(active){setState(readState());setReady(true)}});return()=>{active=false}},[]);
  useEffect(()=>{if(ready)sessionStorage.setItem(storageKey,JSON.stringify(state))},[ready,state]);
  useEffect(()=>{let active=true;getCatalog().then(catalog=>{if(active){setServices(catalog.services);setDoctors(catalog.doctors)}}).catch(()=>{if(active)setCatalogError("Не удалось загрузить услуги.")}).finally(()=>{if(active)setCatalogLoading(false)});return()=>{active=false}},[]);
  const retryCatalog=useCallback(()=>{setCatalogLoading(true);setCatalogError("");getCatalog({force:true}).then(catalog=>{setServices(catalog.services);setDoctors(catalog.doctors)}).catch(()=>setCatalogError("Не удалось загрузить услуги.")).finally(()=>setCatalogLoading(false))},[]);
  const value=useMemo<BookingContextValue>(()=>({state,update:patch=>setState(current=>({...current,...patch})),clear:()=>{sessionStorage.removeItem(storageKey);setState(initialState)},services,doctors,catalogLoading,catalogError,retryCatalog,ready}),[state,services,doctors,catalogLoading,catalogError,retryCatalog,ready]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(){const value=useContext(BookingContext);if(!value)throw new Error("useBooking must be used inside BookingProvider");return value}
