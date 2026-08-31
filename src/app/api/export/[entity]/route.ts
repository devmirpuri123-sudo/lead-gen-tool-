import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { exportRows, toCsv, type ExportEntity } from "@/lib/exportData";

export const dynamic = "force-dynamic";

const ENTITIES: ExportEntity[] = ["markets", "companies", "contacts", "leads"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!ENTITIES.includes(entity as ExportEntity)) {
    return new Response("Unknown export. Use one of: " + ENTITIES.join(", "), { status: 404 });
  }
  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const rows = exportRows(entity as ExportEntity);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `sacvin-lead-engine-${entity}-${stamp}.${format}`;

  if (format === "csv") {
    // BOM so Excel opens UTF-8 correctly.
    return new Response("﻿" + toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, entity.slice(0, 31));
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
