import { supabase } from "./supabase";

export interface TradeListItem {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  source: string | null;
  entry_price: number | null;
  suggested_stop: number | null;
  target_price: number | null;
  target_status: string | null;
  target_checked_at: string | null;
  notes: string | null;
  created_at: string;
}

function computeTargetPrice(
  direction: "LONG" | "SHORT",
  entryPrice: number | null,
  stop: number | null,
): number | null {
  if (entryPrice == null || stop == null) return null;
  const risk = Math.abs(entryPrice - stop);
  if (risk === 0) return null;
  // 1:2 risk-reward ratio
  return direction === "LONG"
    ? entryPrice + risk * 2
    : entryPrice - risk * 2;
}

export async function addToTradeList(
  ticker: string,
  direction: "LONG" | "SHORT",
  source: string,
  entryPrice?: number | null,
  suggestedStop?: number | null,
  targetPrice?: number | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already exists with same direction — avoid duplicates
    const { data: existing } = await supabase
      .from("trade_list")
      .select("id")
      .eq("ticker", ticker)
      .eq("direction", direction)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "Already in trade list" };
    }

    // Use provided target, or compute from entry/stop
    const finalTarget = targetPrice ?? computeTargetPrice(direction, entryPrice ?? null, suggestedStop ?? null);

    const { error } = await supabase.from("trade_list").insert({
      ticker,
      direction,
      source,
      entry_price: entryPrice ?? null,
      suggested_stop: suggestedStop ?? null,
      target_price: finalTarget,
      target_status: finalTarget != null ? "PENDING" : null,
    });

    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to add" };
  }
}

export async function removeFromTradeList(id: string): Promise<void> {
  await supabase.from("trade_list").delete().eq("id", id);
}

export async function updateTradeListNotes(id: string, notes: string): Promise<void> {
  await supabase.from("trade_list").update({ notes }).eq("id", id);
}

export async function fetchTradeList(): Promise<TradeListItem[]> {
  const { data, error } = await supabase
    .from("trade_list")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeListItem[];
}
