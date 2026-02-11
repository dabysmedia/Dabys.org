import fs from "fs";
import path from "path";

// Default data directory baked into the image
const DEFAULT_DATA_DIR = path.join(process.cwd(), "src", "data");
// Allow overriding via env (e.g. Railway volume mounted at /data)
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;

function ensureDataFile(filename: string) {
  const targetPath = path.join(DATA_DIR, filename);

  // Always ensure the directory exists before any read/write
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // If using a custom DATA_DIR and the file doesn't exist there yet,
  // seed it from the baked-in src/data copy (if present).
  if (!fs.existsSync(targetPath) && DATA_DIR !== DEFAULT_DATA_DIR) {
    const defaultPath = path.join(DEFAULT_DATA_DIR, filename);
    if (fs.existsSync(defaultPath)) {
      fs.copyFileSync(defaultPath, targetPath);
    }
  }

  return targetPath;
}

function readJson<T>(filename: string): T {
  const filePath = ensureDataFile(filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeJson<T>(filename: string, data: T) {
  const filePath = ensureDataFile(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ──── Users ─────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
}

export function getUsers(): User[] {
  return readJson<User[]>("users.json");
}

export function saveUsers(users: User[]) {
  writeJson("users.json", users);
}

// ──── Profiles ──────────────────────────────────────────
export interface Profile {
  userId: string;
  avatarUrl: string;   // profile picture URL
  bannerUrl: string;   // banner/hero background URL
  bio: string;         // short bio text
  skipsUsed: number;   // how many skips this user has spent
}

export function getProfiles(): Profile[] {
  return readJson<Profile[]>("profiles.json");
}

export function saveProfiles(profiles: Profile[]) {
  writeJson("profiles.json", profiles);
}

export function getProfile(userId: string): Profile {
  const profiles = getProfiles();
  return profiles.find((p) => p.userId === userId) || {
    userId,
    avatarUrl: "",
    bannerUrl: "",
    bio: "",
    skipsUsed: 0,
  };
}

export function saveProfile(profile: Profile) {
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.userId === profile.userId);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  saveProfiles(profiles);
}

// ──── Weeks ─────────────────────────────────────────────
export interface Week {
  id: string;
  theme: string;
  phase: string; // subs_open | subs_closed | vote_open | vote_closed | winner_published
  startedAt: string;
  endedAt?: string;
}

export function getWeeks(): Week[] {
  return readJson<Week[]>("weeks.json");
}

export function saveWeeks(weeks: Week[]) {
  writeJson("weeks.json", weeks);
}

export function getCurrentWeek(): Week | null {
  const weeks = getWeeks();
  return weeks.find((w) => !w.endedAt) || null;
}

// ──── Submissions ───────────────────────────────────────
export interface Submission {
  id: string;
  weekId: string;
  userId: string;
  userName: string;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  tmdbId?: number;
  year?: string;
  overview?: string;
  trailerUrl?: string;
  backdropUrl?: string;
  createdAt: string;
}

export function getSubmissions(): Submission[] {
  return readJson<Submission[]>("submissions.json");
}

export function saveSubmissions(submissions: Submission[]) {
  writeJson("submissions.json", submissions);
}

// ──── Winners ───────────────────────────────────────────
export interface Winner {
  id: string;
  weekId: string;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  submittedBy: string;
  publishedAt: string;
  tmdbId?: number;
  year?: string;
  overview?: string;
  trailerUrl?: string;
  backdropUrl?: string;
}

export function getWinners(): Winner[] {
  return readJson<Winner[]>("winners.json");
}

export function saveWinners(winners: Winner[]) {
  writeJson("winners.json", winners);
}

// ──── Votes (one per user per week) ─────────────────────
export interface Vote {
  id: string;
  weekId: string;
  userId: string;
  userName: string;
  submissionId: string;
  createdAt: string;
}

export function getVotes(): Vote[] {
  return readJson<Vote[]>("votes.json");
}

export function saveVotes(votes: Vote[]) {
  writeJson("votes.json", votes);
}

// ──── Ratings (thumbs + stars per user per winner) ──────
export interface Rating {
  id: string;
  winnerId: string;
  userId: string;
  userName: string;
  thumbsUp: boolean; // true = up, false = down
  stars: number; // 1-5
  createdAt: string;
}

/** Single source of truth: Dabys score 0–100 from thumbs + stars. Used by winner API and stats API. */
export function computeDabysScorePct(ratings: { thumbsUp: boolean; stars: number }[]): number {
  if (ratings.length === 0) return 0;
  const scores = ratings.map((r) => {
    const thumbScore = r.thumbsUp ? 100 : 0;
    const starScore = ((r.stars - 0.5) / 4.5) * 100;
    return (thumbScore + starScore) / 2;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function getRatings(): Rating[] {
  return readJson<Rating[]>("ratings.json");
}

export function saveRatings(ratings: Rating[]) {
  writeJson("ratings.json", ratings);
}

// ──── Comments (tweet-style with optional media) ────────
export interface Comment {
  id: string;
  winnerId: string;
  userId: string;
  userName: string;
  text: string;
  mediaUrl: string; // image or gif URL
  mediaType: string; // "image" | "gif" | ""
  createdAt: string;
  parentId?: string; // set for replies
}

export function getComments(): Comment[] {
  return readJson<Comment[]>("comments.json");
}

export function saveComments(comments: Comment[]) {
  writeJson("comments.json", comments);
}

// ──── Comment likes (userId likes commentId) ─────────────
export interface CommentLike {
  commentId: string;
  userId: string;
}

export function getCommentLikes(): CommentLike[] {
  try {
    return readJson<CommentLike[]>("commentLikes.json");
  } catch {
    return [];
  }
}

export function saveCommentLikes(likes: CommentLike[]) {
  writeJson("commentLikes.json", likes);
}

// ──── Theme Wheel ───────────────────────────────────────
export interface WheelData {
  entries: string[];
  lastResult: string | null;
  lastSpunAt: string | null;
  spinning: boolean;
  // Sync fields — stored so all clients can replay the same animation
  spinStartedAt: string | null; // ISO timestamp when spin was initiated
  winnerIndex: number | null;   // which segment won
  fullSpins: number | null;     // number of full rotations (for consistent animation)
  duration: number | null;      // animation duration in ms
}

export function getWheel(): WheelData {
  return readJson<WheelData>("wheel.json");
}

export function saveWheel(wheel: WheelData) {
  writeJson("wheel.json", wheel);
}
