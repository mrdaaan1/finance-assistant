// Движок игры "5 букв" (аналог Wordle/игры Т-Банка): загадывается одно
// русское существительное из 5 букв на день, у игрока 6 попыток, после
// каждой попытки буквы подсвечиваются статусами correct/present/absent.

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 6;

export type LetterStatus = "correct" | "present" | "absent";

// Слова, которые могут быть загаданы (частые существительные, им. падеж,
// ед. число, ровно 5 букв). Список проверен построчно на длину.
export const ANSWER_WORDS = [
  "весна", "осень", "город", "улица", "школа", "книга", "стена", "поезд",
  "мышка", "рынок", "парта", "полка", "лампа", "жизнь", "смысл", "слово",
  "буква", "текст", "песня", "танец", "театр", "музей", "мечта", "птица",
  "рыбка", "белка", "мышца", "ветер", "дождь", "озеро", "трава", "гроза",
  "вечер", "рамка", "маска", "плата", "почта", "земля", "тесто", "сумка",
  "гость", "сокол", "робот", "ветка", "берег", "холод", "туман", "тропа",
  "домик", "ножка", "вагон", "замок", "запах", "игрок", "класс", "кофта",
  "крыша", "магия", "нитка", "обувь", "опера", "паста", "песок", "печка",
  "плита", "повар", "поиск", "право", "радио", "ранец", "рифма", "салат",
  "свеча", "сироп", "скала", "совет", "спорт", "стиль", "точка", "удача",
  "фильм", "форма", "халат", "хвост", "цапля", "чашка", "шапка", "штора",
  "щенок", "экран", "якорь", "автор", "адрес", "актёр", "акция", "армия",
  "афиша", "базар", "банан", "барон", "белье", "блеск", "бокал", "брюки",
  "ванна", "вилка", "волна", "гамак", "герой", "глыба", "голос", "грива",
  "грипп",
];

// Более широкий список слов, допустимых для ввода (валидация попытки).
// Пока совпадает со списком возможных ответов — все они реальные слова
// русского языка; при желании его можно расширить отдельными словами,
// которые не должны загадываться, но допустимы как попытка.
export const VALID_GUESS_WORDS = [...ANSWER_WORDS];

const VALID_GUESS_SET = new Set(VALID_GUESS_WORDS.map((w) => w.toLowerCase()));

/** Является ли слово допустимым для ввода (есть в словаре). */
export function isValidGuess(word: string): boolean {
  return VALID_GUESS_SET.has(word.toLowerCase());
}

/**
 * Слово дня определяется детерминированно от календарной даты (UTC), чтобы
 * все игроки в один день видели одно и то же слово и результат не зависел
 * от клиентских часов пользователя.
 */
export function dateSeed(date: Date = new Date()): number {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor(utcMidnight / 86400000);
}

export function wordForDate(date: Date = new Date()): string {
  const seed = dateSeed(date);
  return ANSWER_WORDS[seed % ANSWER_WORDS.length];
}

/**
 * Оценивает попытку против загаданного слова по правилам Wordle: сначала
 * помечаются точные совпадения позиций, затем оставшиеся буквы ищутся на
 * других местах — с учётом того, что повторяющаяся буква в догадке не может
 * дать больше "present"-подсказок, чем осталось непомеченных вхождений в
 * загаданном слове.
 */
export function evaluateGuess(guess: string, answer: string): LetterStatus[] {
  const g = guess.toLowerCase().split("");
  const a = answer.toLowerCase().split("");
  const statuses: LetterStatus[] = Array(WORD_LENGTH).fill("absent");
  const remaining: Record<string, number> = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === a[i]) {
      statuses[i] = "correct";
    } else {
      remaining[a[i]] = (remaining[a[i]] ?? 0) + 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (statuses[i] === "correct") continue;
    const letter = g[i];
    if (remaining[letter] > 0) {
      statuses[i] = "present";
      remaining[letter] -= 1;
    }
  }

  return statuses;
}

export function isWin(statuses: LetterStatus[]): boolean {
  return statuses.every((s) => s === "correct");
}
