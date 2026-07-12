"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { MoneyInput } from "@/components/MoneyInput";
import { SegmentedSelect } from "@/components/SegmentedSelect";
import { useSession } from "@/lib/finance/session-context";
import type { Asset, AssetType } from "@/lib/finance/types";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string; icon: string }[] = [
  { value: "real_estate", label: "Недвижимость", icon: "🏠" },
  { value: "car", label: "Автомобиль", icon: "🚗" },
  { value: "gadget", label: "Гаджет", icon: "📱" },
  { value: "other", label: "Другое", icon: "💼" },
];

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  real_estate: "Недвижимость",
  car: "Автомобиль",
  gadget: "Гаджет",
  other: "Другое",
};

const ASSET_TYPE_ICONS: Record<AssetType, string> = {
  real_estate: "🏠",
  car: "🚗",
  gadget: "📱",
  other: "💼",
};

function AssetsPageContent() {
  const { supabase, profile } = useSession();
  const [assets, setAssets] = useState<Asset[]>([]);

  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("real_estate");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadAssets() {
    const { data } = await supabase.from("assets").select("*").order("created_at", { ascending: false });
    if (data) setAssets(data as Asset[]);
  }

  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !name || !value) return;

    setSubmitting(true);
    await supabase.from("assets").insert({
      user_id: profile.id,
      asset_type: assetType,
      name,
      current_value: Number(value),
    });
    setSubmitting(false);

    setName("");
    setValue("");
    await loadAssets();
  }

  async function handleDelete(id: string) {
    await supabase.from("assets").delete().eq("id", id);
    await loadAssets();
  }

  const totalValue = assets.reduce((sum, a) => sum + a.current_value, 0);

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold">Мои активы</h1>

      <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white p-5 shadow-sm">
        <p className="text-white/80 text-xs uppercase tracking-wide">Общий капитал</p>
        <p className="text-3xl font-extrabold">{formatMoney(totalValue)} ₽</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3"
      >
        <p className="font-semibold">Добавить актив</p>
        <SegmentedSelect options={ASSET_TYPE_OPTIONS} value={assetType} onChange={setAssetType} columns={4} />
        <input
          type="text"
          placeholder="Название (например, Квартира на Ленина)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <MoneyInput
          value={value}
          onChange={setValue}
          placeholder="Текущая стоимость"
          className="rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent w-full"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-accent text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          Добавить
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="flex items-center justify-between rounded-xl bg-card border border-card-border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{ASSET_TYPE_ICONS[asset.asset_type]}</span>
              <div className="flex flex-col">
                <span className="font-medium">{asset.name}</span>
                <span className="text-xs text-muted">{ASSET_TYPE_LABELS[asset.asset_type]}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{formatMoney(asset.current_value)} ₽</span>
              <button
                onClick={() => handleDelete(asset.id)}
                aria-label="Удалить"
                className="text-muted hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {assets.length === 0 && (
          <p className="text-muted text-center py-6">Пока нет добавленных активов</p>
        )}
      </div>
    </main>
  );
}

export default function AssetsPage() {
  return (
    <AuthGate>
      <AssetsPageContent />
    </AuthGate>
  );
}
