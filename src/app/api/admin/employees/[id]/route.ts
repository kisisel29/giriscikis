import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { describeMovement } from "@/lib/attendance/labels";
import { formatDateTime } from "@/lib/time";
import { employeeHistory, listDevices, listEmployees, updateEmployee } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const employee = (await listEmployees()).find((item) => item.id === id);
    if (!employee) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
    const history = await employeeHistory(id);
    return NextResponse.json({
      employee,
      devices: await listDevices(id),
      history: history.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        eventTime: event.eventTime,
        when: formatDateTime(event.eventTime),
        ...describeMovement(event, undefined, history),
        customExitReason: event.customExitReason,
        exitCategory: event.exitCategory,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    return NextResponse.json(await updateEmployee(id, await request.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
