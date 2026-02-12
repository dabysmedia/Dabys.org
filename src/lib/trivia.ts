import { getWinners, saveTriviaSession, getAndConsumeTriviaSession } from "@/lib/data";
import { addCredits, saveTriviaAttempt } from "@/lib/data";
import type { TriviaAttempt } from "@/lib/data";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const CREDITS_PER_CORRECT = 5;
const CREDITS_FULL_SCORE_BONUS = 25;
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
  return { cast, crew, year, title: m.title || "" };
}

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
      question: `What year was ${movieTitle} released?`,
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
      question: `Who directed ${movieTitle}?`,
      options: opts,
      correctIndex: correctIdx,
    });
  }

  for (const c of cast.slice(0, 5)) {
    const actor = c.name;
    const character = c.character;
    const otherActors = cast.filter((x) => x.name !== actor).map((x) => x.name);
    const decoys = pickDecoys(actor, otherActors.length >= 3 ? otherActors : ["Unknown", "Various", "N/A"], 3, (a, b) => a === b);
    const opts = shuffle(decoys);
    const correctIdx = opts.indexOf(actor);
    questions.push({
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: `Who played ${character} in ${movieTitle}?`,
      options: opts,
      correctIndex: correctIdx,
    });
  }

  for (const c of cast.slice(0, 5)) {
    const actor = c.name;
    const character = c.character;
    const otherChars = cast.filter((x) => x.character !== character).map((x) => x.character);
    const decoys = pickDecoys(character, otherChars.length >= 3 ? otherChars : ["Unknown", "Various", "N/A"], 3, (a, b) => a === b);
    const opts = shuffle(decoys);
    const correctIdx = opts.indexOf(character);
    questions.push({
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: `${actor} played which character in ${movieTitle}?`,
      options: opts,
      correctIndex: correctIdx,
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
