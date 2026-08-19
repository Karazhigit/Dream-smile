export type NotificationEvent =
  | "booking_created"
  | "booking_confirmed"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "appointment_reminder";

export type NotificationPayload = {
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  doctorName: string;
  serviceName: string;
  appointmentAt?: string;
};

const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export function formatNotificationDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day || !months[month - 1]) return value;
  return `${day} ${months[month - 1]} ${year}`;
}

function details(payload: NotificationPayload) {
  return `Дата: ${formatNotificationDate(payload.appointmentDate)}\nВремя: ${payload.appointmentTime}\nСпециалист: ${payload.doctorName}\nУслуга: ${payload.serviceName}`;
}

export function buildNotificationMessage(event: NotificationEvent, payload: NotificationPayload) {
  const appointmentDetails = details(payload);
  switch (event) {
    case "booking_confirmed":
      return `Здравствуйте, ${payload.patientName}!\n\nВаша запись в стоматологию Dream Smile подтверждена.\n\n${appointmentDetails}\n\nЕсли ваши планы изменились, пожалуйста, сообщите нам заранее.\n\nС уважением,\nDream Smile`;
    case "booking_rescheduled":
      return `Здравствуйте, ${payload.patientName}!\n\nВаша запись в стоматологию Dream Smile перенесена.\n\n${appointmentDetails}\n\nС уважением,\nDream Smile`;
    case "booking_cancelled":
      return `Здравствуйте, ${payload.patientName}!\n\nВаша запись в стоматологию Dream Smile отменена.\n\n${appointmentDetails}\n\nЕсли это произошло по ошибке, пожалуйста, свяжитесь с нами.\n\nС уважением,\nDream Smile`;
    case "appointment_reminder":
      return `Здравствуйте, ${payload.patientName}!\n\nНапоминаем: через 1 час у вас запись в стоматологию Dream Smile.\n\n${appointmentDetails}\n\nДо встречи!\nDream Smile`;
    case "booking_created":
      return `Здравствуйте, ${payload.doctorName}!\n\nУ вас новая запись в Dream Smile.\n\nПациент: ${payload.patientName}\nДата: ${formatNotificationDate(payload.appointmentDate)}\nВремя: ${payload.appointmentTime}\nУслуга: ${payload.serviceName}`;
  }
}

export function buildDoctorNotificationMessage(event: NotificationEvent, payload: NotificationPayload) {
  if (event === "booking_rescheduled") {
    return `Здравствуйте, ${payload.doctorName}!\n\nЗапись пациента ${payload.patientName} перенесена.\n\n${details(payload)}`;
  }
  if (event === "booking_cancelled") {
    return `Здравствуйте, ${payload.doctorName}!\n\nЗапись пациента ${payload.patientName} отменена.\n\n${details(payload)}`;
  }
  return buildNotificationMessage(event, payload);
}
