// Декларативный список ачивок. Каждая проверяется на клиенте из уже
// загруженных данных пользователя — без отдельного бэкенд-подсчёта на
// каждое действие. Начисление бустов идёт через RPC grant_achievement,
// который атомарно защищён unique(user_id, achievement_key) от дублей.

export type AchievementCategory = "streak" | "action" | "milestone";

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  icon: string;
  boosts: number;
  category: AchievementCategory;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // Стрик
  { key: "streak_3", title: "Разогрев", description: "Веди операции 3 дня подряд", icon: "🔥", boosts: 20, category: "streak" },
  { key: "streak_7", title: "Неделя привычки", description: "Серия из 7 дней подряд", icon: "🔥", boosts: 50, category: "streak" },
  { key: "streak_30", title: "Железная дисциплина", description: "Серия из 30 дней подряд", icon: "🔥", boosts: 200, category: "streak" },
  { key: "streak_100", title: "Легенда бюджета", description: "Серия из 100 дней подряд", icon: "🔥", boosts: 500, category: "streak" },

  // Разовые действия
  { key: "first_transaction", title: "Первый шаг", description: "Добавь первую операцию", icon: "💸", boosts: 15, category: "action" },
  { key: "first_income", title: "Первая копейка", description: "Добавь первый доход", icon: "💰", boosts: 15, category: "action" },
  { key: "first_saving", title: "Первое накопление", description: "Отложи деньги в первый раз", icon: "🐷", boosts: 20, category: "action" },
  { key: "first_goal", title: "Мечтатель", description: "Создай свою первую цель", icon: "🎯", boosts: 20, category: "action" },
  { key: "goal_achieved", title: "Цель достигнута", description: "Накопи полную сумму по любой цели", icon: "🏆", boosts: 100, category: "action" },
  { key: "first_asset", title: "Первый актив", description: "Добавь свой первый актив", icon: "🏦", boosts: 15, category: "action" },
  { key: "first_recurring", title: "Планировщик", description: "Добавь регулярную ежемесячную трату", icon: "📅", boosts: 15, category: "action" },
  { key: "played_slots", title: "Азартный кот", description: "Сделай ставку в игровом автомате", icon: "🎰", boosts: 10, category: "action" },
  { key: "played_block_blast", title: "Пазломан", description: "Сыграй партию в блок-пазл", icon: "🧩", boosts: 10, category: "action" },
  { key: "block_blast_100", title: "Собери линию", description: "Набери 100 очков в блок-пазле", icon: "🧩", boosts: 30, category: "milestone" },
  { key: "played_chess", title: "Гроссмейстер", description: "Сыграй партию в шахматы", icon: "♟️", boosts: 15, category: "action" },
  { key: "chess_win", title: "Шах и мат", description: "Выиграй партию в шахматы", icon: "👑", boosts: 30, category: "action" },
  { key: "talked_to_cat", title: "Знакомство", description: "Поговори с Фиником в первый раз", icon: "🐾", boosts: 15, category: "action" },
  { key: "exported_report", title: "Отчётность", description: "Выгрузи отчёт в Excel", icon: "📊", boosts: 10, category: "action" },
  { key: "premium", title: "Premium-кот", description: "Оформи Premium-статус", icon: "⭐", boosts: 30, category: "action" },

  // Накопительные результаты
  { key: "transactions_10", title: "Втянулся", description: "10 операций в приложении", icon: "📈", boosts: 20, category: "milestone" },
  { key: "transactions_50", title: "Опытный учётчик", description: "50 операций в приложении", icon: "📈", boosts: 60, category: "milestone" },
  { key: "transactions_200", title: "Мастер учёта", description: "200 операций в приложении", icon: "📈", boosts: 150, category: "milestone" },
  { key: "goals_3", title: "Стратег", description: "3 активные или достигнутые цели", icon: "🗺️", boosts: 40, category: "milestone" },
];

export const ACHIEVEMENTS_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

export type AchievementInputs = {
  currentStreak: number;
  longestStreak: number;
  transactionsCount: number;
  hasIncome: boolean;
  hasSaving: boolean;
  goalsCount: number;
  hasAchievedGoal: boolean;
  assetsCount: number;
  recurringCount: number;
  hasSlotSpin: boolean;
  blockBlastBestScore: number;
  hasChessGame: boolean;
  hasChessWin: boolean;
  hasTalkedToCat: boolean;
  hasExportedReport: boolean;
  isPremium: boolean;
};

/** Возвращает ключи ачивок, условия которых выполнены прямо сейчас. */
export function computeUnlockedKeys(inputs: AchievementInputs): Set<string> {
  const unlocked = new Set<string>();
  const bestStreak = Math.max(inputs.currentStreak, inputs.longestStreak);

  if (bestStreak >= 3) unlocked.add("streak_3");
  if (bestStreak >= 7) unlocked.add("streak_7");
  if (bestStreak >= 30) unlocked.add("streak_30");
  if (bestStreak >= 100) unlocked.add("streak_100");

  if (inputs.transactionsCount >= 1) unlocked.add("first_transaction");
  if (inputs.hasIncome) unlocked.add("first_income");
  if (inputs.hasSaving) unlocked.add("first_saving");
  if (inputs.goalsCount >= 1) unlocked.add("first_goal");
  if (inputs.hasAchievedGoal) unlocked.add("goal_achieved");
  if (inputs.assetsCount >= 1) unlocked.add("first_asset");
  if (inputs.recurringCount >= 1) unlocked.add("first_recurring");
  if (inputs.hasSlotSpin) unlocked.add("played_slots");
  if (inputs.blockBlastBestScore > 0) unlocked.add("played_block_blast");
  if (inputs.blockBlastBestScore >= 100) unlocked.add("block_blast_100");
  if (inputs.hasChessGame) unlocked.add("played_chess");
  if (inputs.hasChessWin) unlocked.add("chess_win");
  if (inputs.hasTalkedToCat) unlocked.add("talked_to_cat");
  if (inputs.hasExportedReport) unlocked.add("exported_report");
  if (inputs.isPremium) unlocked.add("premium");

  if (inputs.transactionsCount >= 10) unlocked.add("transactions_10");
  if (inputs.transactionsCount >= 50) unlocked.add("transactions_50");
  if (inputs.transactionsCount >= 200) unlocked.add("transactions_200");
  if (inputs.goalsCount >= 3) unlocked.add("goals_3");

  return unlocked;
}
