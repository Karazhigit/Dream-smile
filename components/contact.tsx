import { Arrow, Clock, Pin } from "./icons";
import { FadeInSection } from "./motion";
import { clinicConfig, getClinicPhoneHref, getClinicWhatsAppHref } from "@/lib/clinic-config";

export function Contact(){
  const phoneHref=getClinicPhoneHref();
  const whatsappHref=getClinicWhatsAppHref();
  const twoGisUrl=clinicConfig["2gisUrl"];
  const hasReviewsLink=Boolean(twoGisUrl||clinicConfig.instagram);

  return <>
    {hasReviewsLink&&<FadeInSection className="border-y border-line bg-background py-16"><div className="container-page grid items-center gap-8 md:grid-cols-[1fr_auto]"><div><p className="eyebrow">Отзывы пациентов</p><h2 className="mt-3 font-serif text-3xl sm:text-4xl">Ваше доверие важно</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Отзывы о клинике можно посмотреть в официальных профилях.</p></div><div className="flex flex-wrap gap-3">{twoGisUrl&&<a href={twoGisUrl} target="_blank" rel="noreferrer" className="btn-secondary focus-ring">Отзывы в 2GIS</a>}{clinicConfig.instagram&&<a href={clinicConfig.instagram} target="_blank" rel="noreferrer" className="btn-secondary focus-ring">Instagram</a>}</div></div></FadeInSection>}
    <FadeInSection id="contacts" className="section-pad bg-white"><div className="container-page grid gap-10 lg:grid-cols-2"><div><p className="eyebrow">Контакты</p><h2 className="section-title mt-4">Мы в {clinicConfig.city}</h2><p className="mt-5 max-w-lg text-sm leading-7 text-muted">{clinicConfig.name}<br/>г. {clinicConfig.city}{clinicConfig.address&&<><br/>{clinicConfig.address}</>}</p><div className="mt-8 flex flex-wrap gap-3">{phoneHref&&<a href={phoneHref} className="btn-primary focus-ring">Позвонить</a>}{whatsappHref&&<a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-primary focus-ring">WhatsApp</a>}{twoGisUrl&&<a href={twoGisUrl} target="_blank" rel="noreferrer" className="btn-secondary focus-ring">Открыть в 2GIS <Arrow/></a>}{clinicConfig.instagram&&<a href={clinicConfig.instagram} target="_blank" rel="noreferrer" className="btn-secondary focus-ring">Instagram</a>}</div></div><div className={`grid gap-4 ${clinicConfig.address?"sm:grid-cols-2":"grid-cols-1"}`}>{clinicConfig.address&&<div className="motion-card rounded-2xl bg-background p-6"><Pin className="h-6 w-6 text-primary"/><p className="mt-8 text-xs font-bold uppercase tracking-wider text-muted">Адрес</p><b className="mt-2 block leading-6">{clinicConfig.city}<br/>{clinicConfig.address}</b></div>}<div className="motion-card rounded-2xl bg-secondary p-6"><Clock className="h-6 w-6 text-primary"/><p className="mt-8 text-xs font-bold uppercase tracking-wider text-muted">График</p><dl className="mt-3 grid gap-2">{clinicConfig.workingHours.map(item=><div key={item.days} className="flex items-baseline justify-between gap-4"><dt className="text-sm font-bold">{item.days}</dt><dd className={item.closed?"text-sm text-muted":"text-sm font-bold"}>{item.hours}</dd></div>)}</dl></div></div></div></FadeInSection>
  </>;
}
