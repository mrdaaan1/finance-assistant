"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";
import type { Asset, AssetType } from "@/lib/finance/types";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

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
        <select
          value={assetType}
          onChange={(e) => setAssetType(e.target.value as AssetType)}
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((type) => (
            <option key={type} value={type}>
              {ASSET_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Название (например, Квартира на Ленина)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="number"
          inputMode="decimal"
          placeholder="Текущая стоимость, ₽"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
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
            <span className="font-semibold">{formatMoney(asset.current_value)} ₽</span>
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
