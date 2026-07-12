const ICON_MAP: Record<string, string> = {
  utensils: "🍔",
  car: "🚗",
  home: "🏠",
  "party-popper": "🎉",
  "heart-pulse": "💊",
  "shopping-bag": "🛍️",
  "more-horizontal": "🔖",
  wallet: "💼",
  briefcase: "💻",
  "plus-circle": "➕",
};

export function categoryIcon(icon: string | null): string {
  if (!icon) return "🔖";
  return ICON_MAP[icon] ?? "🔖";
}
