// Billflow — send-invoice-email Edge Function
// Sends an invoice or reminder email via Resend. The Resend API key lives as a
// Supabase secret and is NEVER exposed to the browser.
//
// Security: the caller's JWT is forwarded, so the invoice + client are read under
// Row Level Security — a user can only ever email their own invoices, to the
// client's stored address (the browser cannot pick an arbitrary recipient).
//
// Deploy: Supabase Dashboard -> Edge Functions -> Deploy a new function ->
// name it exactly "send-invoice-email" -> paste this file -> Deploy.
// Secrets needed (Edge Functions -> Secrets): RESEND_API_KEY, and optionally
// MAIL_FROM (defaults to Resend's shared onboarding sender).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "Billflow <onboarding@resend.dev>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY secret is not set in Supabase" }, 500);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { invoice_id, mode } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id required" }, 400);

    // RLS guarantees these belong to the caller.
    const { data: inv, error: ie } = await sb.from("invoices").select("*").eq("id", invoice_id).single();
    if (ie || !inv) return json({ error: "Invoice not found" }, 404);
    const { data: client } = await sb.from("clients").select("*").eq("id", inv.client_id).single();
    const { data: settings } = await sb.from("settings").select("*").eq("user_id", user.id).single();
    const co = settings?.company ?? {};

    if (!client?.email) return json({ error: "This client has no email address" }, 400);

    const curSym: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$", INR: "₹" };
    const sym = curSym[co.currency] ?? "$";
    const money = (n: number) => sym + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const items = Array.isArray(inv.items) ? inv.items : [];
    const subtotal = items.reduce((a: number, it: any) => a + Number(it.q || 0) * Number(it.p || 0), 0);
    const taxAmt = subtotal * (Number(inv.tax_rate || 0) / 100);
    const totalDue = subtotal - Number(inv.discount || 0) + taxAmt;

    const rows = items.map((it: any) =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(it.d) || "Item"}</td>
       <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${esc(it.q)}</td>
       <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${money(Number(it.p))}</td>
       <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${money(Number(it.q) * Number(it.p))}</td></tr>`
    ).join("");

    const overdue = inv.due && inv.due < new Date().toISOString().slice(0, 10) && inv.status !== "paid";
    const isRemind = mode === "remind";
    const subject = isRemind
      ? `Reminder: invoice ${inv.num} (${money(totalDue)}) ${overdue ? "is overdue" : "is due " + (inv.due || "soon")}`
      : `Invoice ${inv.num} from ${co.name ?? "us"} — ${money(totalDue)}`;

    const intro = isRemind
      ? `This is a friendly reminder that invoice <b>${esc(inv.num)}</b> for <b>${money(totalDue)}</b> ${overdue ? `was due on <b>${esc(inv.due)}</b> and is now overdue` : `is due on <b>${esc(inv.due) || "soon"}</b>`}.`
      : `Please find your invoice <b>${esc(inv.num)}</b> below.`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#0f172a">
        <h2 style="margin:0 0 4px">Invoice ${esc(inv.num)}</h2>
        <p style="color:#475569;margin:0 0 20px">From ${esc(co.name ?? "")}</p>
        <p>Hi ${esc(client.name)},</p>
        <p>${intro}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr style="color:#94a3b8;font-size:12px;text-transform:uppercase">
            <td style="padding:6px 0;border-bottom:2px solid #eee">Description</td>
            <td style="padding:6px 0;border-bottom:2px solid #eee;text-align:right">Qty</td>
            <td style="padding:6px 0;border-bottom:2px solid #eee;text-align:right">Price</td>
            <td style="padding:6px 0;border-bottom:2px solid #eee;text-align:right">Amount</td>
          </tr>
          ${rows}
        </table>
        <div style="text-align:right;font-size:18px;font-weight:bold">Total due: ${money(totalDue)}</div>
        <p style="color:#475569">Issued ${esc(inv.issued)} &middot; Due ${esc(inv.due) || "—"}</p>
        ${inv.notes || co.notes ? `<p style="color:#475569;border-top:1px solid #eee;padding-top:12px">${esc(inv.notes || co.notes)}</p>` : ""}
        <p>Thanks,<br>${esc(co.name ?? "")}</p>
      </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [client.email], reply_to: co.email, subject, html }),
    });
    const body = await r.json();
    if (!r.ok) return json({ error: body.message ?? "Resend rejected the email", detail: body }, 400);

    return json({ ok: true, id: body.id, to: client.email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
