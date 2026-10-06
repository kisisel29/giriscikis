"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";

type Item = {
  id: string;
  action: string;
  tableName: string;
  reason: string;
  createdAt: string;
  oldData: unknown;
  newData: unknown;
};

export function AuditList() {
  const [rows, setRows] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Item[]>("/api/admin/audit")
      .then(setRows)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Günlük alınamadı."));
  }, []);

  return (
    <div className="grid gap-3">
      <h1 className="text-3xl font-semibold">Audit log</h1>
      {error ? <p className="text-rose-700">{error}</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <p className="font-semibold">
            {row.action} · {row.tableName}
          </p>
          <p className="text-sm">{row.reason}</p>
          <p className="text-xs text-slate-500">{row.createdAt}</p>
          <details className="mt-2 text-xs">
            <summary>Eski ve yeni veri</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify({ old: row.oldData, new: row.newData }, null, 2)}</pre>
          </details>
        </article>
      ))}
    </div>
  );
}
