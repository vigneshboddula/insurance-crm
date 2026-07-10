// Client-safe helpers for interim WhatsApp / call actions.
// Today these open wa.me / tel: links (you send from your own WhatsApp manually).
// In Phase 3 these become true one-click automated sends from your linked number.

export function digits(phone?: string | null): string {
  return (phone ?? "").replace(/[^0-9]/g, "");
}

export function waLink(phone?: string | null, text?: string): string {
  const base = `https://wa.me/${digits(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(phone?: string | null): string {
  return `tel:${digits(phone)}`;
}
