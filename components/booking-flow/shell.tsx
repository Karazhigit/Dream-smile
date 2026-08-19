"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBooking } from "./context";
import { clinicConfig } from "@/lib/clinic-config";

const steps=[{path:"/booking/service",label:"Услуга"},{path:"/booking/doctor",label:"Специалист"},{path:"/booking/datetime",label:"Дата и время"},{path:"/booking/contact",label:"Контакты"}];

export function BookingShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();const{clear}=useBooking();const active=Math.max(0,steps.findIndex(step=>step.path===pathname));const success=pathname==="/booking/success";
  return <div className="min-h-screen bg-background"><header className="border-b border-line bg-white"><div className="mx-auto flex min-h-[78px] w-[min(1160px,calc(100%_-_32px))] items-center justify-between gap-4"><Link href="/" className="focus-ring leading-none"><span className="block font-serif text-[24px] tracking-[-.04em]">{clinicConfig.name}</span><span className="mt-1 block text-[8px] font-extrabold tracking-[.25em] text-primary">СТОМАТОЛОГИЯ</span></Link><Link href="/" onClick={success?clear:undefined} className="focus-ring text-right text-xs font-bold text-muted transition hover:text-primary sm:text-sm">Вернуться на сайт</Link></div></header>{!success&&<nav aria-label="Этапы записи" className="border-b border-line bg-white"><ol className="mx-auto grid w-[min(760px,calc(100%_-_28px))] grid-cols-4 py-4">{steps.map((step,index)=>{const current=index===active;const passed=index<active;return <li key={step.path} aria-current={current?"step":undefined} className="relative flex flex-col items-center text-center"><span className={`motion-progress relative z-10 grid h-8 w-8 place-items-center rounded-full border text-xs font-extrabold ${current||passed?"border-primary bg-primary text-white":"border-line bg-white text-muted"}`}>{index+1}</span><span className={`motion-progress mt-2 hidden text-[11px] font-bold sm:block ${current?"text-primary":"text-muted"}`}>{step.label}</span>{index<steps.length-1&&<span className={`motion-progress absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-4 h-px ${passed?"bg-primary":"bg-line"}`}/>}</li>})}</ol></nav>}<main className="mx-auto w-[min(1160px,calc(100%_-_28px))] py-9 sm:py-14">{children}</main></div>;
}
