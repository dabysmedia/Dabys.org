import { getWinners, saveTriviaSession, getAndConsumeTriviaSession } from "@/lib/data";
import { addCredits, saveTriviaAttempt } from "@/lib/data";
import type { TriviaAttempt } from "@/lib/data";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const CREDITS_PER_CORRECT = 10;
const CREDITS_FULL_SCORE_BONUS = 10;
const QUESTIONS_PER_ROUND = 5;

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

async function fetchTmdbCredits(tmdbId: number): Promise<{
  cast: { name: string; character: string }[];
  crew: { name: string; job: string }[];
  year: string;
  title: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
} | null> {
  if (!TMDB_API_KEY) return null;
  const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("append_to_response", "credits");
  url.searchParams.set("language", "en-US");
  const res = await fetch(url.toString());
  const m = await res.json();
  if (!res.ok || !m.credits) return null;
  const cast = (m.credits.cast || []).filter(
    (c: { name?: string; character?: string }) => c.name && c.character
  );
  const crew = (m.credits.crew || []).filter(
    (c: { job?: string }) => c.job === "Director"
  );
  const year = m.release_date ? m.release_date.slice(0, 4) : "";
  const runtime = typeof m.runtime === "number" && m.runtime > 0 ? m.runtime : null;
  const genres = Array.isArray(m.genres) ? m.genres.map((g: { id?: number; name?: string }) => ({ id: g.id ?? 0, name: g.name ?? "" })).filter((g: { name: string }) => g.name) : [];
  return { cast, crew, year, title: m.title || "", runtime, genres };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const YEAR_PHRASES = [
  (t: string) => `When did ${t} hit the big screen?`,
  (t: string) => `In what year did ${t} premiere?`,
  (t: string) => `What year did ${t} come out?`,
];
const DIRECTOR_PHRASES = [
  (t: string) => `Who's behind the camera for ${t}?`,
  (t: string) => `Which director called the shots on ${t}?`,
  (t: string) => `Who directed ${t}?`,
];
const ACTOR_PHRASES = [
  (char: string, title: string) => `Which actor brought ${char} to life in ${title}?`,
  (char: string, title: string) => `Who stepped into the role of ${char} in ${title}?`,
  (char: string, title: string) => `Who played ${char} in ${title}?`,
];
const CHARACTER_PHRASES = [
  (actor: string, title: string) => `What role did ${actor} play in ${title}?`,
  (actor: string, title: string) => `Which character did ${actor} play in ${title}?`,
  (actor: string, title: string) => `Who did ${actor} play in ${title}?`,
];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickDecoys<T>(
  correct: T,
  pool: T[],
  count: number,
  eq: (a: T, b: T) => boolean
): T[] {
  const others = pool.filter((x) => !eq(x, correct));
  const shuffled = shuffle(others);
  const decoys = shuffled.slice(0, count);
  const opts = shuffle([correct, ...decoys]);
  return opts;
}

export async function generateTriviaQuestions(
  winnerId: string,
  userId: string
): Promise<TriviaQuestion[]> {
  const winners = getWinners();
  const winner = winners.find((w) => w.id === winnerId);
  if (!winner?.tmdbId) return [];

  const data = await fetchTmdbCredits(winner.tmdbId);
  if (!data) return [];

  const { cast, crew, year, title } = data;
  const movieTitle = winner.movieTitle || title;
  const questions: TriviaQuestion[] = [];

  const allWinners = getWinners().filter((w) => w.tmdbId && w.id !== winnerId);
  const otherYears = allWinners
    .map((w) => w.year)
    .filter((y): y is string => !!y)
    .filter((y) => y !== year);
  const otherDirectors: string[] = [];

  for (const w of allWinners.slice(0, 10)) {
    const d = await fetchTmdbCredits(w.tmdbId!);
    if (d?.crew?.length) {
      d.crew.forEach((c) => {
        if (c.name && c.name !== "" && !otherDirectors.includes(c.name)) {
          otherDirectors.push(c.name);
        }
      });
    }
  }

  if (year) {
    const decoyYears = pickDecoys(
      year,
      otherYears.length >= 3 ? otherYears : [String(parseInt(year) - 1), String(parseInt(year) + 1), String(parseInt(year) - 2)],
      3,
      (a, b) => a === b
    );
    const opts = shuffle(decoyYears);
    const correctIdx = opts.indexOf(year);
    questions.push({
      id: `y-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: pickRandom(YEAR_PHRASES)(movieTitle),
      options: opts,
      correctIndex: correctIdx,
    });
  }

  if (crew.length > 0) {
    const director = crew[0].name;
    const decoys = pickDecoys(
      director,
      otherDirectors.length >= 3 ? otherDirectors : ["Unknown", "Various", "N/A"],
      3,
      (a, b) => a === b
    );
    const opts = shuffle(decoys);
    const correctIdx = opts.indexOf(director);
    questions.push({
      id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: pickRandom(DIRECTOR_PHRASES)(movieTitle),
      options: opts,
      correctIndex: correctIdx,
    });
  }

  // At most 1 actor question per round; ask either "who played X?" OR "X played who?" so we never add both for the same role
  for (const c of cast.slice(0, 1)) {
    const actor = c.name;
    const character = c.character;
    const askActor = Math.random() < 0.5; // who played character vs which character did actor play
    if (askActor) {
      const otherActors = cast.filter((x) => x.name !== actor).map((x) => x.name);
      const decoys = pickDecoys(actor, otherActors.length >= 3 ? otherActors : ["Unknown", "Various", "N/A"], 3, (a, b) => a === b);
      const opts = shuffle(decoys);
      const correctIdx = opts.indexOf(actor);
      questions.push({
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        question: pickRandom(ACTOR_PHRASES)(character, movieTitle),
        options: opts,
        correctIndex: correctIdx,
      });
    } else {
      const otherChars = cast.filter((x) => x.character !== character).map((x) => x.character);
      const decoys = pickDecoys(character, otherChars.length >= 3 ? otherChars : ["Unknown", "Various", "N/A"], 3, (a, b) => a === b);
      const opts = shuffle(decoys);
      const correctIdx = opts.indexOf(character);
      questions.push({
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        question: pickRandom(CHARACTER_PHRASES)(actor, movieTitle),
        options: opts,
        correctIndex: correctIdx,
      });
    }
  }

  // Runtime (TMDB)
  if (data.runtime != null && data.runtime > 0) {
    const ranges = [
      { label: "Under 90 min", min: 0, max: 90 },
      { label: "90–120 min", min: 90, max: 120 },
      { label: "2–3 hours", min: 120, max: 180 },
      { label: "Over 3 hours", min: 180, max: 999 },
    ];
    const correctRange = ranges.find((r) => data.runtime! >= r.min && data.runtime! < r.max) ?? ranges[0];
    const otherLabels = ranges.filter((r) => r.label !== correctRange.label).map((r) => r.label);
    const runtimeOpts = shuffle([correctRange.label, ...otherLabels.slice(0, 3)]);
    const runtimeCorrectIdx = runtimeOpts.indexOf(correctRange.label);
    questions.push({
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: `How long is ${movieTitle}?`,
      options: runtimeOpts,
      correctIndex: runtimeCorrectIdx >= 0 ? runtimeCorrectIdx : 0,
    });
  }

  // Genre (TMDB)
  if (data.genres.length > 0) {
    const primaryGenre = data.genres[0].name;
    const otherGenreNames = new Set<string>();
    for (const w of allWinners.slice(0, 15)) {
      const d = await fetchTmdbCredits(w.tmdbId!);
      if (d?.genres?.length) d.genres.forEach((g) => g.name && otherGenreNames.add(g.name));
    }
    const fallbackGenres = ["Drama", "Comedy", "Action", "Horror", "Thriller", "Sci-Fi", "Romance"];
    const decoyPool = otherGenreNames.size >= 3 ? [...otherGenreNames] : fallbackGenres.filter((g) => g !== primaryGenre);
    const genreDecoys = pickDecoys(primaryGenre, decoyPool, 3, (a, b) => a === b);
    const genreOpts = shuffle(genreDecoys);
    const genreCorrectIdx = genreOpts.indexOf(primaryGenre);
    questions.push({
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: `Which genre best describes ${movieTitle}?`,
      options: genreOpts,
      correctIndex: genreCorrectIdx,
    });
  }

  const selected = shuffle(questions).slice(0, QUESTIONS_PER_ROUND);
  saveTriviaSession({
    userId,
    winnerId,
    questions: selected,
    createdAt: new Date().toISOString(),
  });
  return selected;
}

export function submitTriviaAnswers(
  winnerId: string,
  userId: string,
  answers: { questionId: string; selectedIndex: number }[]
): { success: boolean; correctCount: number; totalCount: number; creditsEarned: number; error?: string } {
  const session = getAndConsumeTriviaSession(userId, winnerId);
  if (!session) {
    return { success: false, correctCount: 0, totalCount: 0, creditsEarned: 0, error: "Session expired or not found" };
  }

  const byId = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  let correctCount = 0;

  for (const q of session.questions) {
    const selected = byId.get(q.id);
    if (typeof selected === "number" && selected === q.correctIndex) {
      correctCount++;
    }
  }

  const totalCount = session.questions.length;
  const creditsPerCorrect = CREDITS_PER_CORRECT;
  const bonus = correctCount === totalCount && totalCount > 0 ? CREDITS_FULL_SCORE_BONUS : 0;
  const creditsEarned = correctCount * creditsPerCorrect + bonus;

  addCredits(userId, creditsEarned, "trivia", {
    winnerId,
    correctCount,
    totalCount,
  });

  const attempt: TriviaAttempt = {
    id: `ta-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    winnerId,
    score: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
    correctCount,
    totalCount,
    creditsEarned,
    completedAt: new Date().toISOString(),
  };
  saveTriviaAttempt(attempt);

  return { success: true, correctCount, totalCount, creditsEarned };
}
