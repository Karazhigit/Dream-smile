import { requireAdminApi } from "@/lib/supabase/admin-auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext<"/api/admin/appointments/[id]/notifications">) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return Response.json({ error: "Некорректная запись." }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("notification_jobs")
    .select("id,event_type,recipient_type,status,scheduled_for,sent_at,attempts")
    .eq("appointment_id", id)
    .in("event_type", ["booking_confirmed", "appointment_reminder"])
    .order("created_at", { ascending: false });

  if (error?.code === "PGRST205" || error?.code === "42P01") {
    return Response.json({ configured: false, notifications: [] });
  }
  if (error) {
    console.error("[api/admin/appointments/notifications GET] Query failed", { code: error.code });
    return Response.json({ error: "Не удалось загрузить статусы уведомлений." }, { status: 500 });
  }
  return Response.json({ configured: true, notifications: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
