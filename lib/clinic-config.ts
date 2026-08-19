export const clinicConfig = {
  name: "Dream Smile",
  city: "Жезказган",

  // Заполнить после подтверждения владельцем: публичные источники указывают разные адреса.
  address: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  "2gisUrl": "",

  workingHours: [
    { days: "Пн–Пт", hours: "09:00–19:00", closed: false },
    { days: "Сб", hours: "10:00–14:00", closed: false },
    { days: "Вс", hours: "Выходной", closed: true },
  ],

  servicesDescription: [
    "Диагностика",
    "Лечение зубов",
    "Лечение кариеса",
    "Стоматолог-хирург",
    "Неотложная стоматология",
    "Современная диагностика",
  ],
  clinicFeatures: ["Современная диагностика"],
  about: {
    eyebrow: "О клинике",
    title: "Забота о здоровье вашей улыбки",
    description: "Стоматология, где внимание уделяется диагностике, лечению и комфорту пациента.",
  },

  bookingHref: "/booking/service",
  navigation: [
    { label: "Услуги", href: "#services" },
    { label: "Специалисты", href: "#specialists" },
    { label: "О клинике", href: "#about" },
    { label: "Запись", href: "/booking/service" },
    { label: "Контакты", href: "#contacts" },
  ],
  cta: {
    header: "Записаться",
    hero: "Записаться на приём",
    consultation: "Записаться на консультацию",
  },
} as const;

export function getClinicPhoneHref(value = clinicConfig.phone) {
  const normalized = value.trim().replace(/[^+\d]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

export function getClinicWhatsAppHref(value = clinicConfig.whatsapp) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}
