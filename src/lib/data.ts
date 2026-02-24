import crypto from "crypto";
import fs from "fs";
import path from "path";

// All JSON (packs, characterPool, cards, credits, etc.) is read/written under this directory.
// Default: src/data. Set DATA_DIR=/data (or any path) to save elsewhere (e.g. mounted volume).
const DEFAULT_DATA_DIR = path.join(process.cwd(), "src", "data");
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
  /** Optional PIN for login (editable in admin and user profile). */
  pin?: string;
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
  /** Extra skips granted from shop purchases. */
  bonusSkips?: number;
  featuredCardIds?: string[];       // up to 6 codex character IDs to showcase
  /** Single winner ID to show as badge next to name (replaces displayedBadgeWinnerIds). */
  displayedBadgeWinnerId?: string | null;
  /** Winner IDs from shop purchases (movie badges from shop). */
  purchasedBadgeWinnerIds?: string[];
  /** Standalone badges from shop (not tied to a movie). itemId, name, imageUrl snapshot. */
  purchasedBadges?: { itemId: string; name: string; imageUrl?: string }[];
  /** Shop item ID to show as displayed badge (standalone badge from shop). */
  displayedBadgeShopItemId?: string | null;
  /** @deprecated Use displayedBadgeWinnerId. Kept for migration when reading JSON. */
  displayedBadgeWinnerIds?: string[];
  /** User-chosen favourite movie from TMDB (overrides auto from highest rating). */
  favoriteMovieTmdbId?: number | null;
  /** Snapshot when favourite is from TMDB: title, poster, backdrop, year, letterboxdUrl. */
  favoriteMovieSnapshot?: { title: string; posterUrl: string; backdropUrl: string; year: string; letterboxdUrl: string } | null;
}

export function getProfiles(): Profile[] {
  return readJson<Profile[]>("profiles.json");
}

export function saveProfiles(profiles: Profile[]) {
  writeJson("profiles.json", profiles);
}

export function getProfile(userId: string): Profile {
  const profiles = getProfiles();
  const found = profiles.find((p) => p.userId === userId);
  if (found) {
    const displayedBadgeWinnerId =
      found.displayedBadgeWinnerId ??
      (Array.isArray(found.displayedBadgeWinnerIds) && found.displayedBadgeWinnerIds.length > 0
        ? found.displayedBadgeWinnerIds[0]
        : null);
    return {
      ...found,
      featuredCardIds: found.featuredCardIds ?? [],
      displayedBadgeWinnerId: displayedBadgeWinnerId ?? undefined,
      bonusSkips: found.bonusSkips ?? 0,
      purchasedBadgeWinnerIds: found.purchasedBadgeWinnerIds ?? [],
      purchasedBadges: found.purchasedBadges ?? [],
      displayedBadgeShopItemId: found.displayedBadgeShopItemId ?? undefined,
    };
  }
  return {
    userId,
    avatarUrl: "",
    bannerUrl: "",
    bio: "",
    skipsUsed: 0,
    bonusSkips: 0,
    featuredCardIds: [],
    displayedBadgeWinnerId: undefined,
    purchasedBadgeWinnerIds: [],
    purchasedBadges: [],
    displayedBadgeShopItemId: undefined,
  };
}

export function saveProfile(profile: Profile) {
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.userId === profile.userId);
  const toSave = { ...profile };
  delete (toSave as Record<string, unknown>).displayedBadgeWinnerIds;
  if (idx >= 0) profiles[idx] = toSave;
  else profiles.push(toSave);
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
  /** Elevator pitch (max 100 chars), only settable by submitter */
  pitch?: string;
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
  runtime?: number; // minutes (from TMDB)
  /** When the movie will be screened (ISO date string). Shown when winner is published. */
  screeningAt?: string;
}

export function getWinners(): Winner[] {
  return readJson<Winner[]>("winners.json");
}

export function saveWinners(winners: Winner[]) {
  writeJson("winners.json", winners);
}

/** True if the winner's week has ended (archived in winners circle). Reviews/comments/trivia are locked until then. */
export function isWinnerArchived(winnerId: string): boolean {
  const winners = getWinners();
  const winner = winners.find((w) => w.id === winnerId);
  if (!winner?.weekId) return true; // No week = treat as archived (allow interactions for legacy)
  const weeks = getWeeks();
  const week = weeks.find((w) => w.id === winner.weekId);
  return !!week?.endedAt;
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

// ──── Movie Night Attendance (who showed up, pack awarded) ──────
export interface WeekAttendance {
  attended: string[]; // userIds who showed up
  packAwarded: string[]; // userIds who received the premium pack
}

type MovieNightAttendanceStore = Record<string, WeekAttendance>;

function getMovieNightAttendanceRaw(): MovieNightAttendanceStore {
  try {
    return readJson<MovieNightAttendanceStore>("movieNightAttendance.json");
  } catch {
    return {};
  }
}

function saveMovieNightAttendanceRaw(store: MovieNightAttendanceStore) {
  writeJson("movieNightAttendance.json", store);
}

export function getWeekAttendance(weekId: string): WeekAttendance {
  const store = getMovieNightAttendanceRaw();
  const w = store[weekId];
  return w ?? { attended: [], packAwarded: [] };
}

export function setWeekAttendance(weekId: string, attended: string[]): void {
  const store = getMovieNightAttendanceRaw();
  const existing = store[weekId] ?? { attended: [], packAwarded: [] };
  store[weekId] = { ...existing, attended };
  saveMovieNightAttendanceRaw(store);
}

export function toggleWeekAttendance(weekId: string, userId: string): void {
  const store = getMovieNightAttendanceRaw();
  const existing = store[weekId] ?? { attended: [], packAwarded: [] };
  const idx = existing.attended.indexOf(userId);
  const attended =
    idx >= 0
      ? existing.attended.filter((id) => id !== userId)
      : [...existing.attended, userId];
  store[weekId] = { ...existing, attended };
  saveMovieNightAttendanceRaw(store);
}

export function markPackAwardedForWeek(weekId: string, userId: string): void {
  const store = getMovieNightAttendanceRaw();
  const existing = store[weekId] ?? { attended: [], packAwarded: [] };
  if (existing.packAwarded.includes(userId)) return;
  store[weekId] = { ...existing, packAwarded: [...existing.packAwarded, userId] };
  saveMovieNightAttendanceRaw(store);
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

// ──── Comment dislikes (userId dislikes commentId; mutually exclusive with like; no credits) ───
export interface CommentDislike {
  commentId: string;
  userId: string;
}

export function getCommentDislikes(): CommentDislike[] {
  try {
    return readJson<CommentDislike[]>("commentDislikes.json");
  } catch {
    return [];
  }
}

export function saveCommentDislikes(dislikes: CommentDislike[]) {
  writeJson("commentDislikes.json", dislikes);
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
  // After confirm: keep result/position visible for all until next spin
  lastConfirmedResult?: string | null;
  lastConfirmedAt?: string | null;
}

export function getWheel(): WheelData {
  return readJson<WheelData>("wheel.json");
}

export function saveWheel(wheel: WheelData) {
  writeJson("wheel.json", wheel);
}

// ──── Wheel history (confirmed themes for admin "previous winners" list) ────
export interface WheelHistoryEntry {
  theme: string;
  confirmedAt: string; // ISO
}

export function getWheelHistory(): WheelHistoryEntry[] {
  try {
    return readJson<WheelHistoryEntry[]>("wheelHistory.json");
  } catch {
    return [];
  }
}

export function saveWheelHistory(history: WheelHistoryEntry[]) {
  writeJson("wheelHistory.json", history);
}

// ──── Vault (original Dabys Media YouTube content) ────
export interface VaultVideo {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnailUrl?: string;
  order: number;
  featured: boolean;
}

function getVaultVideosRaw(): VaultVideo[] {
  try {
    return readJson<VaultVideo[]>("vaultVideos.json");
  } catch {
    return [];
  }
}

export function getVaultVideos(): VaultVideo[] {
  return getVaultVideosRaw().sort((a, b) => a.order - b.order);
}

export function saveVaultVideos(videos: VaultVideo[]) {
  writeJson("vaultVideos.json", videos);
}

// ──── Watchlist (per-user: movies to suggest in the future) ────
export interface WatchlistItem {
  id: string;
  userId: string;
  tmdbId: number;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  year?: string;
  addedAt: string; // ISO
}

function getWatchlistRaw(): WatchlistItem[] {
  try {
    return readJson<WatchlistItem[]>("watchlist.json");
  } catch {
    return [];
  }
}

function saveWatchlistRaw(items: WatchlistItem[]) {
  writeJson("watchlist.json", items);
}

export function getWatchlist(userId: string): WatchlistItem[] {
  return getWatchlistRaw()
    .filter((w) => w.userId === userId)
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

export function addWatchlistItem(
  userId: string,
  item: Omit<WatchlistItem, "id" | "userId" | "addedAt">
): WatchlistItem {
  const raw = getWatchlistRaw();
  const existing = raw.find(
    (w) => w.userId === userId && w.tmdbId === item.tmdbId
  );
  if (existing) return existing;

  const newItem: WatchlistItem = {
    id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    tmdbId: item.tmdbId,
    movieTitle: item.movieTitle,
    posterUrl: item.posterUrl,
    letterboxdUrl: item.letterboxdUrl,
    year: item.year,
    addedAt: new Date().toISOString(),
  };
  raw.push(newItem);
  saveWatchlistRaw(raw);
  return newItem;
}

export function removeWatchlistItem(userId: string, tmdbId: number): boolean {
  const raw = getWatchlistRaw();
  const idx = raw.findIndex((w) => w.userId === userId && w.tmdbId === tmdbId);
  if (idx < 0) return false;
  raw.splice(idx, 1);
  saveWatchlistRaw(raw);
  return true;
}

// ──── Tracked Cards (TCG: users track character IDs they want; acquirer gets notified) ─
const TRACKED_CARDS_MAX_PER_USER = 10;

function getTrackedCardsRaw(): Record<string, string[]> {
  try {
    return readJson<Record<string, string[]>>("trackedCards.json");
  } catch {
    return {};
  }
}

function saveTrackedCardsRaw(data: Record<string, string[]>) {
  writeJson("trackedCards.json", data);
}

export function getTrackedCharacterIds(userId: string): string[] {
  const data = getTrackedCardsRaw();
  const list = data[userId] ?? [];
  return Array.isArray(list) ? list.slice(0, TRACKED_CARDS_MAX_PER_USER) : [];
}

export function addTrackedCharacter(userId: string, characterId: string): boolean {
  const data = getTrackedCardsRaw();
  const list = data[userId] ?? [];
  if (!Array.isArray(list)) return false;
  if (list.includes(characterId)) return true;
  if (list.length >= TRACKED_CARDS_MAX_PER_USER) return false;
  data[userId] = [...list, characterId];
  saveTrackedCardsRaw(data);
  return true;
}

export function removeTrackedCharacter(userId: string, characterId: string): boolean {
  const data = getTrackedCardsRaw();
  const list = data[userId] ?? [];
  if (!Array.isArray(list)) return false;
  const idx = list.indexOf(characterId);
  if (idx < 0) return false;
  data[userId] = list.filter((_, i) => i !== idx);
  saveTrackedCardsRaw(data);
  return true;
}

/** Returns count of users (excluding acquirerUserId) who are tracking this character. */
export function getUsersTrackingCharacterCount(characterId: string, excludeUserId?: string): number {
  const data = getTrackedCardsRaw();
  let count = 0;
  for (const [uid, list] of Object.entries(data)) {
    if (uid === excludeUserId) continue;
    if (Array.isArray(list) && list.includes(characterId)) count++;
  }
  return count;
}

/** If other users are tracking this character, notify the acquirer. Call when a user acquires a card. */
export function notifyAcquirerIfTracked(
  acquirerUserId: string,
  characterId: string,
  cardDisplayName: string
): void {
  const count = getUsersTrackingCharacterCount(characterId, acquirerUserId);
  if (count < 1) return;
  const msg = count === 1
    ? `1 user is tracking ${cardDisplayName}`
    : `${count} users are tracking ${cardDisplayName}`;
  addNotification({
    type: "card_tracked_by_others",
    targetUserId: acquirerUserId,
    message: msg,
    meta: { characterId, cardDisplayName, trackerCount: count },
  });
}

// ──── Credit Settings (reward amounts, editable in admin) ─
export interface CreditSettings {
  submission: number;
  vote: number;
  submissionWin: number;
  /** Credits per vote received, awarded to non-winning submitters when winner is published. */
  votesReceivedPerVote: number;
  rating: number;
  comment: number;
  /** Quicksell (vendor) credits per rarity. */
  quicksellUncommon: number;
  quicksellRare: number;
  quicksellEpic: number;
  quicksellLegendary: number;
  /** Credits given when epic→legendary trade-up fails (67% chance). */
  tradeUpLegendaryFailureCredits: number;
  /** Credits given when feedback is accepted in the admin panel. */
  feedbackAccepted: number;
  /** Credits awarded when a player completes a set (collects all cards for a movie) and claims the quest. */
  setCompletionReward: number;
  /** Credits awarded when a player completes a full holo set and claims the quest. */
  holoSetCompletionReward: number;
  /** Credits awarded when a player completes a full prismatic set and claims the quest. */
  prismaticSetCompletionReward: number;
  /** Credits awarded when a player completes a full dark matter set and claims the quest. */
  darkMatterSetCompletionReward: number;
  /** Credits awarded for first watch of a Vault video (original Dabys Media content). */
  vaultWatch: number;
  /** Minimum watch time in minutes for Vault video credit claim (timer only runs while playing). */
  vaultMinWatchMinutes: number;
}

const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  submission: 50,
  vote: 50,
  submissionWin: 250,
  votesReceivedPerVote: 50,
  rating: 25,
  comment: 25,
  quicksellUncommon: 5,
  quicksellRare: 20,
  quicksellEpic: 80,
  quicksellLegendary: 200,
  tradeUpLegendaryFailureCredits: 100,
  feedbackAccepted: 10,
  setCompletionReward: 1000,
  holoSetCompletionReward: 1500,
  prismaticSetCompletionReward: 3000,
  darkMatterSetCompletionReward: 5000,
  vaultWatch: 25,
  vaultMinWatchMinutes: 1,
};

function getCreditSettingsRaw(): CreditSettings {
  try {
    const raw = readJson<Partial<CreditSettings>>("creditSettings.json");
    return {
      submission: typeof raw.submission === "number" ? raw.submission : DEFAULT_CREDIT_SETTINGS.submission,
      vote: typeof raw.vote === "number" ? raw.vote : DEFAULT_CREDIT_SETTINGS.vote,
      submissionWin: typeof raw.submissionWin === "number" ? raw.submissionWin : DEFAULT_CREDIT_SETTINGS.submissionWin,
      votesReceivedPerVote: typeof raw.votesReceivedPerVote === "number" ? raw.votesReceivedPerVote : DEFAULT_CREDIT_SETTINGS.votesReceivedPerVote,
      rating: typeof raw.rating === "number" ? raw.rating : DEFAULT_CREDIT_SETTINGS.rating,
      comment: typeof raw.comment === "number" ? raw.comment : DEFAULT_CREDIT_SETTINGS.comment,
      quicksellUncommon: typeof raw.quicksellUncommon === "number" ? raw.quicksellUncommon : DEFAULT_CREDIT_SETTINGS.quicksellUncommon,
      quicksellRare: typeof raw.quicksellRare === "number" ? raw.quicksellRare : DEFAULT_CREDIT_SETTINGS.quicksellRare,
      quicksellEpic: typeof raw.quicksellEpic === "number" ? raw.quicksellEpic : DEFAULT_CREDIT_SETTINGS.quicksellEpic,
      quicksellLegendary: typeof raw.quicksellLegendary === "number" ? raw.quicksellLegendary : DEFAULT_CREDIT_SETTINGS.quicksellLegendary,
      tradeUpLegendaryFailureCredits: typeof raw.tradeUpLegendaryFailureCredits === "number" ? raw.tradeUpLegendaryFailureCredits : DEFAULT_CREDIT_SETTINGS.tradeUpLegendaryFailureCredits,
      feedbackAccepted: typeof raw.feedbackAccepted === "number" ? raw.feedbackAccepted : DEFAULT_CREDIT_SETTINGS.feedbackAccepted,
      setCompletionReward: typeof raw.setCompletionReward === "number" ? raw.setCompletionReward : DEFAULT_CREDIT_SETTINGS.setCompletionReward,
      holoSetCompletionReward: typeof raw.holoSetCompletionReward === "number" ? raw.holoSetCompletionReward : DEFAULT_CREDIT_SETTINGS.holoSetCompletionReward,
      prismaticSetCompletionReward: typeof raw.prismaticSetCompletionReward === "number" ? raw.prismaticSetCompletionReward : DEFAULT_CREDIT_SETTINGS.prismaticSetCompletionReward,
      darkMatterSetCompletionReward: typeof raw.darkMatterSetCompletionReward === "number" ? raw.darkMatterSetCompletionReward : DEFAULT_CREDIT_SETTINGS.darkMatterSetCompletionReward,
      vaultWatch: typeof raw.vaultWatch === "number" ? raw.vaultWatch : DEFAULT_CREDIT_SETTINGS.vaultWatch,
      vaultMinWatchMinutes: typeof raw.vaultMinWatchMinutes === "number" ? raw.vaultMinWatchMinutes : DEFAULT_CREDIT_SETTINGS.vaultMinWatchMinutes,
    };
  } catch {
    return { ...DEFAULT_CREDIT_SETTINGS };
  }
}

export function getCreditSettings(): CreditSettings {
  return getCreditSettingsRaw();
}

export function saveCreditSettings(settings: CreditSettings): void {
  writeJson("creditSettings.json", settings);
}

// ──── Credits (user balances for TCG) ───────────────────
export interface UserCredit {
  userId: string;
  balance: number;
  updatedAt: string;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function getCreditsRaw(): UserCredit[] {
  try {
    return readJson<UserCredit[]>("credits.json");
  } catch {
    return [];
  }
}

function saveCreditsRaw(credits: UserCredit[]) {
  writeJson("credits.json", credits);
}

export function getCreditLedgerRaw(): CreditLedgerEntry[] {
  try {
    return readJson<CreditLedgerEntry[]>("creditLedger.json");
  } catch {
    return [];
  }
}

function saveCreditLedgerRaw(entries: CreditLedgerEntry[]) {
  writeJson("creditLedger.json", entries);
}

export function getCredits(userId: string): number {
  const credits = getCreditsRaw();
  const entry = credits.find((c) => c.userId === userId);
  return entry?.balance ?? 0;
}

/** Returns true if user has already received credits for this reason and week (e.g. vote or submission). */
export function hasReceivedCreditsForWeek(userId: string, reason: string, weekId: string): boolean {
  const ledger = getCreditLedgerRaw();
  return ledger.some(
    (e) =>
      e.userId === userId &&
      e.reason === reason &&
      e.amount > 0 &&
      e.metadata &&
      typeof e.metadata.weekId === "string" &&
      e.metadata.weekId === weekId
  );
}

/** Returns true if user has already received credits for liking this comment (prevents like/unlike farming). */
export function hasReceivedCreditsForCommentLike(userId: string, commentId: string): boolean {
  const ledger = getCreditLedgerRaw();
  return ledger.some(
    (e) =>
      e.userId === userId &&
      e.reason === "comment_like" &&
      e.amount > 0 &&
      e.metadata &&
      typeof e.metadata.commentId === "string" &&
      e.metadata.commentId === commentId
  );
}

/** Returns true if user has already received credits for watching this Vault video (first watch per user per video). */
export function hasReceivedCreditsForVaultWatch(userId: string, videoId: string): boolean {
  const ledger = getCreditLedgerRaw();
  return ledger.some(
    (e) =>
      e.userId === userId &&
      e.reason === "vault_watch" &&
      e.amount > 0 &&
      e.metadata &&
      typeof e.metadata.videoId === "string" &&
      e.metadata.videoId === videoId
  );
}

export function addCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>
) {
  const credits = getCreditsRaw();
  const idx = credits.findIndex((c) => c.userId === userId);
  const now = new Date().toISOString();
  const current = idx >= 0 ? credits[idx].balance : 0;
  const newBalance = current + amount;
  const entry: UserCredit = { userId, balance: newBalance, updatedAt: now };
  if (idx >= 0) credits[idx] = entry;
  else credits.push(entry);
  saveCreditsRaw(credits);

  const ledger = getCreditLedgerRaw();
  ledger.push({
    id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    amount,
    reason,
    metadata,
    createdAt: now,
  });
  saveCreditLedgerRaw(ledger);
}

export function deductCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>
): boolean {
  const current = getCredits(userId);
  if (current < amount) return false;
  const credits = getCreditsRaw();
  const idx = credits.findIndex((c) => c.userId === userId);
  const now = new Date().toISOString();
  const newBalance = current - amount;
  const entry: UserCredit = { userId, balance: newBalance, updatedAt: now };
  if (idx >= 0) credits[idx] = entry;
  else credits.push(entry);
  saveCreditsRaw(credits);

  const ledger = getCreditLedgerRaw();
  ledger.push({
    id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    amount: -amount,
    reason,
    metadata,
    createdAt: now,
  });
  saveCreditLedgerRaw(ledger);
  return true;
}

/** Append a ledger entry without changing balance (e.g. free pack purchase for daily limit counting). */
function addLedgerEntryOnly(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>
) {
  const ledger = getCreditLedgerRaw();
  ledger.push({
    id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    amount,
    reason,
    metadata,
    createdAt: new Date().toISOString(),
  });
  saveCreditLedgerRaw(ledger);
}

/** Start of current restock period (UTC). If restockHour/Minute omitted, uses midnight UTC. */
function getRestockPeriodStartUtc(restockHourUtc?: number, restockMinuteUtc?: number): string {
  const hour = typeof restockHourUtc === "number" && restockHourUtc >= 0 && restockHourUtc <= 23 ? restockHourUtc : 0;
  const minute = typeof restockMinuteUtc === "number" && restockMinuteUtc >= 0 && restockMinuteUtc <= 59 ? restockMinuteUtc : 0;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const periodStart = new Date(Date.UTC(y, m, d, hour, minute, 0, 0));
  if (now.getTime() < periodStart.getTime()) {
    const yesterday = new Date(Date.UTC(y, m, d - 1, hour, minute, 0, 0));
    return yesterday.toISOString();
  }
  return periodStart.toISOString();
}

export interface PackRestockOptions {
  restockIntervalHours?: number;
  restockHourUtc?: number;
  restockMinuteUtc?: number;
}

/** Number of times the user has purchased this pack in the current window (rolling X hours or daily UTC). Per-user. */
export function getPackPurchasesInWindow(
  userId: string,
  packId: string,
  options: PackRestockOptions
): number {
  const ledger = getCreditLedgerRaw();
  const intervalHours = typeof options.restockIntervalHours === "number" && options.restockIntervalHours > 0
    ? options.restockIntervalHours
    : undefined;
  const since =
    intervalHours != null
      ? new Date(Date.now() - intervalHours * 60 * 60 * 1000).toISOString()
      : getRestockPeriodStartUtc(options.restockHourUtc, options.restockMinuteUtc);
  return ledger.filter(
    (e) =>
      e.userId === userId &&
      e.reason === "pack_purchase" &&
      e.metadata &&
      (e.metadata as { packId?: string }).packId === packId &&
      e.createdAt >= since
  ).length;
}

/** Oldest pack_purchase createdAt in the current rolling window (for interval restock). Returns ISO string or null. */
export function getPackOldestPurchaseInWindow(
  userId: string,
  packId: string,
  options: PackRestockOptions
): string | null {
  const intervalHours = typeof options.restockIntervalHours === "number" && options.restockIntervalHours > 0
    ? options.restockIntervalHours
    : undefined;
  if (intervalHours == null) return null;
  const ledger = getCreditLedgerRaw();
  const since = new Date(Date.now() - intervalHours * 60 * 60 * 1000).toISOString();
  const entries = ledger.filter(
    (e) =>
      e.userId === userId &&
      e.reason === "pack_purchase" &&
      e.metadata &&
      (e.metadata as { packId?: string }).packId === packId &&
      e.createdAt >= since
  );
  if (entries.length === 0) return null;
  return entries.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), entries[0].createdAt);
}

/** @deprecated Use getPackPurchasesInWindow. Number of times the user has purchased this pack in the current restock period (UTC day or rolling hours). */
export function getPackPurchasesCountToday(
  userId: string,
  packId: string,
  restock?: { restockHourUtc?: number; restockMinuteUtc?: number }
): number {
  return getPackPurchasesInWindow(userId, packId, restock ?? {});
}

/** Record a pack purchase: deduct credits if amount > 0, else only add ledger entry (for free packs). */
export function recordPackPurchase(
  userId: string,
  packId: string,
  amount: number
): boolean {
  if (amount > 0) {
    return deductCredits(userId, amount, "pack_purchase", { packId });
  }
  addLedgerEntryOnly(userId, 0, "pack_purchase", { packId });
  return true;
}

/** Remove pack_purchase ledger entries for this user only in the current restock period (UTC day from midnight). Lets the user buy again today without wiping all-time pack opening stats. Returns number of entries removed. */
export function resetUserPackPurchaseHistory(userId: string): number {
  const since = getRestockPeriodStartUtc(0, 0); // start of current UTC day
  const ledger = getCreditLedgerRaw();
  const filtered = ledger.filter(
    (e) =>
      !(
        e.userId === userId &&
        e.reason === "pack_purchase" &&
        e.createdAt >= since
      )
  );
  const removed = ledger.length - filtered.length;
  if (removed > 0) saveCreditLedgerRaw(filtered);
  return removed;
}

/** @deprecated Use resetUserPackPurchaseHistory. Alias for backward compat. */
export function resetUserPackPurchasesToday(userId: string): number {
  return resetUserPackPurchaseHistory(userId);
}

export function setCredits(userId: string, balance: number): void {
  const credits = getCreditsRaw();
  const idx = credits.findIndex((c) => c.userId === userId);
  const now = new Date().toISOString();
  const prevBalance = idx >= 0 ? credits[idx].balance : 0;
  const entry: UserCredit = { userId, balance, updatedAt: now };
  if (idx >= 0) credits[idx] = entry;
  else credits.push(entry);
  saveCreditsRaw(credits);

  const ledger = getCreditLedgerRaw();
  ledger.push({
    id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    amount: balance - prevBalance,
    reason: "admin_set",
    metadata: { prevBalance },
    createdAt: now,
  });
  saveCreditLedgerRaw(ledger);
}

/**
 * Roll back a user to the state they were in at the start of `rollbackDate` (YYYY-MM-DD, UTC).
 * Everything that happened on or after that date is undone:
 *  - Credits: remove ledger entries on/after that date, recompute balance.
 *  - Cards: remove cards acquired on/after that date, plus remove marketplace listings for those cards.
 *  - Codex: use activity log to undo unlocks added on/after that date (handles uploads that consumed cards).
 *  - Lottery tickets: remove tickets purchased on/after that date.
 *  - Trades: cancel pending trades created on/after that date that involve this user.
 *  - Marketplace listings: remove listings created on/after that date by this user.
 *
 * NOTE: Stardust and Prisms have no ledger, so their balances cannot be computed for a past date.
 */
export function rollbackUser(userId: string, rollbackDate: string): {
  newBalance: number;
  cardsRemoved: number;
  lotteryTicketsRemoved: number;
  ledgerEntriesRemoved: number;
  codexUnlocksRemoved: number;
  tradesCancelled: number;
  listingsRemoved: number;
  setCompletionQuestsRemoved: number;
} {
  const cutoff = rollbackDate; // YYYY-MM-DD — entries whose date >= this are removed

  // 1. Credits: remove ledger entries on/after cutoff, recompute balance
  const ledger = getCreditLedgerRaw();
  const entriesToRemove = ledger.filter(
    (e) => e.userId === userId && e.createdAt.slice(0, 10) >= cutoff
  );
  const netChangeAfter = entriesToRemove.reduce((sum, e) => sum + e.amount, 0);
  const credits = getCreditsRaw();
  const credIdx = credits.findIndex((c) => c.userId === userId);
  const currentBalance = credIdx >= 0 ? credits[credIdx].balance : 0;
  const restoredBalance = Math.max(0, currentBalance - netChangeAfter);

  const ledgerFiltered = ledger.filter(
    (e) => !(e.userId === userId && e.createdAt.slice(0, 10) >= cutoff)
  );
  saveCreditLedgerRaw(ledgerFiltered);

  const now = new Date().toISOString();
  const creditEntry: UserCredit = { userId, balance: restoredBalance, updatedAt: now };
  if (credIdx >= 0) credits[credIdx] = creditEntry;
  else credits.push(creditEntry);
  saveCreditsRaw(credits);

  // 2. Cards: remove cards acquired on/after cutoff
  const cardsRaw = getCardsRaw();
  const cardsToRemove = cardsRaw.filter(
    (c) => c.userId === userId && c.acquiredAt.slice(0, 10) >= cutoff
  );
  const removedCardIds = new Set<string>(cardsToRemove.map((c) => c.id));
  let cardsRemoved = 0;
  for (const card of cardsToRemove) {
    if (removeCard(card.id)) cardsRemoved++;
  }

  // 3. Codex: use the activity log to undo ALL unlocks added on/after cutoff
  const codexLog = getCodexLogRaw();
  const codexAddsToUndo = codexLog.filter(
    (e) => e.userId === userId && e.action === "add" && e.createdAt.slice(0, 10) >= cutoff
  );
  let codexUnlocksRemoved = 0;
  for (const entry of codexAddsToUndo) {
    switch (entry.variant) {
      case "regular":
        removeCodexUnlock(userId, entry.characterId);
        break;
      case "holo":
        removeCodexUnlockHolo(userId, entry.characterId);
        break;
      case "prismatic":
        removeCodexUnlockPrismatic(userId, entry.characterId);
        break;
      case "darkMatter":
        removeCodexUnlockDarkMatter(userId, entry.characterId);
        break;
      case "altart":
      case "altart_holo":
        removeCodexUnlockAltArt(userId, entry.characterId);
        break;
      case "boys":
        removeCodexUnlockBoys(userId, entry.characterId);
        break;
    }
    codexUnlocksRemoved++;
  }
  // Also clean up the log entries that are on/after cutoff for this user
  const codexLogFiltered = codexLog.filter(
    (e) => !(e.userId === userId && e.createdAt.slice(0, 10) >= cutoff)
  );
  saveCodexLogRaw(codexLogFiltered);

  // 4. Lottery tickets: remove tickets purchased on/after cutoff
  const tickets = getLotteryTicketsRaw();
  const ticketsFiltered = tickets.filter(
    (t) => !(t.userId === userId && t.purchasedAt.slice(0, 10) >= cutoff)
  );
  const lotteryTicketsRemoved = tickets.length - ticketsFiltered.length;
  if (lotteryTicketsRemoved > 0) saveLotteryTicketsRaw(ticketsFiltered);

  // 5. Trades: cancel pending trades created on/after cutoff involving this user
  const trades = getTradesRaw();
  let tradesCancelled = 0;
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (t.status !== "pending") continue;
    const involvesUser = t.initiatorUserId === userId || t.counterpartyUserId === userId;
    const afterCutoff = t.createdAt.slice(0, 10) >= cutoff;
    const involvesRemovedCard =
      t.offeredCardIds?.some((id) => removedCardIds.has(id)) ||
      t.requestedCardIds?.some((id) => removedCardIds.has(id));
    if ((involvesUser && afterCutoff) || involvesRemovedCard) {
      trades[i] = { ...t, status: "denied" as const };
      tradesCancelled++;
    }
  }
  if (tradesCancelled > 0) saveTradesRaw(trades);

  // 6. Marketplace listings: remove listings created on/after cutoff by this user
  const listings = getListingsRaw();
  let listingsRemoved = 0;
  for (const l of listings) {
    if (l.sellerUserId === userId && l.createdAt.slice(0, 10) >= cutoff) {
      removeListing(l.id);
      listingsRemoved++;
    }
  }

  // 7. Set completion quests: remove unclaimed quests completed on/after cutoff
  const scStore = getSetCompletionQuestsRaw();
  const scQuests = scStore[userId] ?? [];
  const scFiltered = scQuests.filter(
    (q) => !(q.completedAt.slice(0, 10) >= cutoff && !q.claimed)
  );
  const setCompletionQuestsRemoved = scQuests.length - scFiltered.length;
  if (setCompletionQuestsRemoved > 0) {
    if (scFiltered.length === 0) delete scStore[userId];
    else scStore[userId] = scFiltered;
    saveSetCompletionQuestsRaw(scStore);
  }

  return {
    newBalance: restoredBalance,
    cardsRemoved,
    lotteryTicketsRemoved,
    ledgerEntriesRemoved: entriesToRemove.length,
    codexUnlocksRemoved,
    tradesCancelled,
    listingsRemoved,
    setCompletionQuestsRemoved,
  };
}

/**
 * Check if rollback undo is available for a user.
 * Currently always returns false — rollback does not persist a snapshot for undo.
 */
export function hasRollbackUndoAvailable(_userId: string): boolean {
  return false;
}

/**
 * Undo the most recent rollback for a user.
 * Currently not implemented — rollback is destructive and does not store state for restore.
 */
export function undoRollbackUser(userId: string): { success: boolean; error?: string } {
  if (!hasRollbackUndoAvailable(userId)) {
    return { success: false, error: "Undo not available" };
  }
  return { success: false, error: "Undo not implemented" };
}

// ──── Stardust (Alchemy) ────────────────────────────────
export interface StardustEntry {
  userId: string;
  balance: number;
  updatedAt: string;
}

export function getStardustRaw(): StardustEntry[] {
  try {
    return readJson<StardustEntry[]>("stardust.json");
  } catch {
    return [];
  }
}

function saveStardustRaw(entries: StardustEntry[]) {
  writeJson("stardust.json", entries);
}

export function getStardust(userId: string): number {
  const entries = getStardustRaw();
  const entry = entries.find((e) => e.userId === userId);
  return entry?.balance ?? 0;
}

export function addStardust(userId: string, amount: number): void {
  const entries = getStardustRaw();
  const idx = entries.findIndex((e) => e.userId === userId);
  const now = new Date().toISOString();
  const current = idx >= 0 ? entries[idx].balance : 0;
  const newBalance = current + amount;
  const entry: StardustEntry = { userId, balance: newBalance, updatedAt: now };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  saveStardustRaw(entries);
}

export function deductStardust(userId: string, amount: number): boolean {
  const current = getStardust(userId);
  if (current < amount) return false;
  const entries = getStardustRaw();
  const idx = entries.findIndex((e) => e.userId === userId);
  const now = new Date().toISOString();
  const newBalance = current - amount;
  const entry: StardustEntry = { userId, balance: newBalance, updatedAt: now };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  saveStardustRaw(entries);
  return true;
}

/** Set a user's stardust balance (admin). Persists to stardust.json in /data. */
export function setStardust(userId: string, balance: number): void {
  const entries = getStardustRaw();
  const idx = entries.findIndex((e) => e.userId === userId);
  const now = new Date().toISOString();
  const entry: StardustEntry = { userId, balance: Math.max(0, Math.floor(balance)), updatedAt: now };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  saveStardustRaw(entries);
}

// ──── Prisms (premium alchemy currency) ──────────────────
interface PrismEntry {
  userId: string;
  balance: number;
  updatedAt: string;
}

export function getPrismsRaw(): PrismEntry[] {
  try {
    return readJson<PrismEntry[]>("prisms.json");
  } catch {
    return [];
  }
}

function savePrismsRaw(entries: PrismEntry[]) {
  writeJson("prisms.json", entries);
}

export function getPrisms(userId: string): number {
  const entries = getPrismsRaw();
  const entry = entries.find((e) => e.userId === userId);
  return entry?.balance ?? 0;
}

export function addPrisms(userId: string, amount: number): void {
  const entries = getPrismsRaw();
  const idx = entries.findIndex((e) => e.userId === userId);
  const now = new Date().toISOString();
  const current = idx >= 0 ? entries[idx].balance : 0;
  const newBalance = current + amount;
  const entry: PrismEntry = { userId, balance: newBalance, updatedAt: now };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  savePrismsRaw(entries);
}

export function deductPrisms(userId: string, amount: number): boolean {
  const current = getPrisms(userId);
  if (current < amount) return false;
  const entries = getPrismsRaw();
  const idx = entries.findIndex((e) => e.userId === userId);
  const now = new Date().toISOString();
  const newBalance = current - amount;
  const entry: PrismEntry = { userId, balance: newBalance, updatedAt: now };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  savePrismsRaw(entries);
  return true;
}

/** Set a user's prism balance (admin). */
export function setPrisms(userId: string, balance: number): void {
  const entries = getPrismsRaw();
  const idx = entries.findIndex((e) => e.userId === userId);
  const now = new Date().toISOString();
  const entry: PrismEntry = { userId, balance: Math.max(0, Math.floor(balance)), updatedAt: now };
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  savePrismsRaw(entries);
}

// ──── Alchemy Settings (admin-configurable) ──────────────
/** Stardust values per rarity (uncommon, rare, epic, legendary) */
export interface AlchemyStardustRarity {
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
  [key: string]: number;
}

export interface AlchemySettings {
  /** Number of epic holo cards required for prism transmute */
  prismTransmuteEpicHoloCount: number;
  /** Success chance (0–100) for prism transmute */
  prismTransmuteSuccessChance: number;
  /** Prisms awarded per successful transmute */
  prismsPerTransmute: number;
  /** Base success chance (0–100) for prismatic crafting with 0 extra prisms */
  prismaticCraftBaseChance: number;
  /** Additional chance (0–100) per prism applied */
  prismaticCraftChancePerPrism: number;
  /** Max prisms that can be applied to a single craft */
  prismaticCraftMaxPrisms: number;
  /** Stardust awarded on prismatic craft failure */
  prismaticCraftFailureStardust: number;
  /** Prisms awarded when disenchanting one Epic Holo in the forge */
  epicHoloForgePrisms: number;
  /** Pack-A-Punch (normal→holo) success chance (0–100) per rarity */
  holoUpgradeChance: AlchemyStardustRarity;
  /** Holo→Prismatic upgrade success chance (0–100) */
  prismaticUpgradeChance: number;
  /** Prismatic→Dark Matter upgrade success chance (0–100) */
  darkMatterUpgradeChance: number;
  /** Stardust from disenchanting Holo by rarity (only Holo can be disenchanted) */
  disenchantHolo: AlchemyStardustRarity;
  /** Stardust cost for Pack-A-Punch (normal→holo) by rarity */
  packAPunchCost: AlchemyStardustRarity;
}

const DEFAULT_STARDUST_HOLO: AlchemyStardustRarity = { uncommon: 10, rare: 20, epic: 30, legendary: 50 };
const DEFAULT_PACK_A_PUNCH: AlchemyStardustRarity = { uncommon: 30, rare: 60, epic: 90, legendary: 120 };
const DEFAULT_HOLO_UPGRADE_CHANCE: AlchemyStardustRarity = { uncommon: 50, rare: 50, epic: 50, legendary: 50 };

const DEFAULT_ALCHEMY_SETTINGS: AlchemySettings = {
  prismTransmuteEpicHoloCount: 3,
  prismTransmuteSuccessChance: 50,
  prismsPerTransmute: 1,
  prismaticCraftBaseChance: 5,
  prismaticCraftChancePerPrism: 10,
  prismaticCraftMaxPrisms: 10,
  prismaticCraftFailureStardust: 25,
  epicHoloForgePrisms: 1,
  holoUpgradeChance: DEFAULT_HOLO_UPGRADE_CHANCE,
  prismaticUpgradeChance: 35,
  darkMatterUpgradeChance: 20,
  disenchantHolo: DEFAULT_STARDUST_HOLO,
  packAPunchCost: DEFAULT_PACK_A_PUNCH,
};

function mergeStardustRarity(
  def: AlchemyStardustRarity,
  raw: Partial<AlchemyStardustRarity> | undefined
): AlchemyStardustRarity {
  if (!raw || typeof raw !== "object") return def;
  return {
    uncommon: typeof raw.uncommon === "number" ? raw.uncommon : def.uncommon,
    rare: typeof raw.rare === "number" ? raw.rare : def.rare,
    epic: typeof raw.epic === "number" ? raw.epic : def.epic,
    legendary: typeof raw.legendary === "number" ? raw.legendary : def.legendary,
  };
}

export function getAlchemySettings(): AlchemySettings {
  try {
    const raw = readJson<Partial<AlchemySettings>>("alchemySettings.json");
    const merged = { ...DEFAULT_ALCHEMY_SETTINGS, ...raw };
    merged.disenchantHolo = mergeStardustRarity(DEFAULT_STARDUST_HOLO, raw.disenchantHolo);
    merged.packAPunchCost = mergeStardustRarity(DEFAULT_PACK_A_PUNCH, raw.packAPunchCost);
    if (typeof raw.holoUpgradeChance === "number") {
      merged.holoUpgradeChance = { uncommon: raw.holoUpgradeChance, rare: raw.holoUpgradeChance, epic: raw.holoUpgradeChance, legendary: raw.holoUpgradeChance };
    } else {
      merged.holoUpgradeChance = mergeStardustRarity(DEFAULT_HOLO_UPGRADE_CHANCE, raw.holoUpgradeChance);
    }
    return merged;
  } catch {
    return { ...DEFAULT_ALCHEMY_SETTINGS };
  }
}

export function saveAlchemySettings(settings: AlchemySettings): void {
  writeJson("alchemySettings.json", settings);
}

// ──── Card Finish (visual tier: normal < holo < prismatic < darkMatter) ────
export type CardFinish = "normal" | "holo" | "prismatic" | "darkMatter";

/** Ordered list of finishes from lowest to highest tier. */
export const CARD_FINISH_ORDER: readonly CardFinish[] = ["normal", "holo", "prismatic", "darkMatter"] as const;

/** Human-readable labels for each finish tier. */
export const CARD_FINISH_LABELS: Record<CardFinish, string> = {
  normal: "Normal",
  holo: "Holo",
  prismatic: "Prismatic",
  darkMatter: "Dark Matter",
};

/** Derive the canonical finish for a card, handling legacy isFoil-only cards. */
export function getCardFinish(card: { isFoil?: boolean; finish?: CardFinish }): CardFinish {
  if (card.finish) return card.finish;
  return card.isFoil ? "holo" : "normal";
}

/** True if finish A is strictly higher tier than finish B. */
export function isHigherFinish(a: CardFinish, b: CardFinish): boolean {
  return CARD_FINISH_ORDER.indexOf(a) > CARD_FINISH_ORDER.indexOf(b);
}

/** Returns the next finish tier above the given one, or null if already at max. */
export function nextFinishTier(current: CardFinish): CardFinish | null {
  const idx = CARD_FINISH_ORDER.indexOf(current);
  return idx < CARD_FINISH_ORDER.length - 1 ? CARD_FINISH_ORDER[idx + 1] : null;
}

// ──── Card Types (multi-type pool) ───────────────────────
export type CardType = "actor" | "director" | "character" | "scene";

export interface CustomCardType {
  id: string;
  label: string;
}

const CUSTOM_CARD_TYPES_FILE = "customCardTypes.json";

function getCustomCardTypesRaw(): CustomCardType[] {
  try {
    return readJson<CustomCardType[]>(CUSTOM_CARD_TYPES_FILE);
  } catch {
    return [];
  }
}

function saveCustomCardTypesRaw(types: CustomCardType[]) {
  writeJson(CUSTOM_CARD_TYPES_FILE, types);
}

export function getCustomCardTypes(): CustomCardType[] {
  return getCustomCardTypesRaw();
}

/** All card type IDs (base + custom) for validation. */
export function getAllowedCardTypeIds(): string[] {
  const base: CardType[] = ["actor", "director", "character", "scene"];
  const custom = getCustomCardTypesRaw().map((t) => t.id);
  return [...base, ...custom];
}

export function addCustomCardType(id: string, label: string): CustomCardType | null {
  const idNorm = id.trim().toLowerCase().replace(/\s+/g, "-");
  if (!idNorm || /[^a-z0-9-]/.test(idNorm)) return null;
  const existing = getCustomCardTypesRaw();
  if (existing.some((t) => t.id === idNorm)) return null;
  const base: CardType[] = ["actor", "director", "character", "scene"];
  if (base.includes(idNorm as CardType)) return null;
  const entry: CustomCardType = { id: idNorm, label: label.trim() || idNorm };
  existing.push(entry);
  saveCustomCardTypesRaw(existing);
  return entry;
}

export function removeCustomCardType(id: string): boolean {
  const existing = getCustomCardTypesRaw();
  const filtered = existing.filter((t) => t.id !== id);
  if (filtered.length === existing.length) return false;
  saveCustomCardTypesRaw(filtered);
  return true;
}

// ──── Character Pool (TCG: actor as character in movie) ──
export interface CharacterPortrayal {
  characterId: string;
  tmdbPersonId?: number; // optional for Scene (no person)
  actorName: string;
  characterName: string;
  profilePath: string;
  movieTmdbId: number;
  movieTitle: string;
  popularity: number;
  rarity: "uncommon" | "rare" | "epic" | "legendary";
  cardType?: CardType | string; // optional for migration; defaults to "actor". string for custom types.
  /** When set, this pool entry is an alt-art; owning a card with this characterId counts as owning this character for set completion. */
  altArtOfCharacterId?: string;
  /** For Boys (cardType "character"): custom set name to group by in codex instead of movie. */
  customSetId?: string;
}

export interface Card {
  id: string;
  userId: string;
  characterId: string;
  rarity: "uncommon" | "rare" | "epic" | "legendary";
  isFoil: boolean;
  /** Visual finish tier. Takes precedence over isFoil when set. Legacy cards without this field use isFoil to derive finish. */
  finish?: CardFinish;
  actorName: string;
  characterName: string;
  movieTitle: string;
  movieTmdbId: number;
  profilePath: string;
  acquiredAt: string;
  cardType?: CardType | string; // optional for migration; defaults to "actor". string for custom types.
}

function getCharacterPoolRaw(): CharacterPortrayal[] {
  try {
    return readJson<CharacterPortrayal[]>("characterPool.json");
  } catch {
    return [];
  }
}

function saveCharacterPoolRaw(pool: CharacterPortrayal[]) {
  writeJson("characterPool.json", pool);
}

/** One-time migration: add cardType to cards missing it, then persist. */
export function migrateCardsAddCardType(): void {
  const cards = getCardsRaw();
  const needsMigration = cards.some((c) => !c.cardType);
  if (!needsMigration) return;
  const migrated = cards.map((c) => (c.cardType ? c : { ...c, cardType: "actor" as CardType }));
  saveCardsRaw(migrated);
}

/** One-time migration: convert common -> uncommon in cards and character pool. */
export function migrateCommonToUncommon(): void {
  const cards = getCardsRaw();
  const needsCards = cards.some((c) => (c as { rarity: string }).rarity === "common");
  if (needsCards) {
    saveCardsRaw(cards.map((c) => ((c as { rarity: string }).rarity === "common" ? { ...c, rarity: "uncommon" as const } : c)));
  }
  const pool = getCharacterPoolRaw();
  const needsPool = pool.some((c) => (c as { rarity: string }).rarity === "common");
  if (needsPool) {
    saveCharacterPoolRaw(pool.map((c) => ((c as { rarity: string }).rarity === "common" ? { ...c, rarity: "uncommon" as const } : c)));
  }
}

export function getCardsRaw(): Card[] {
  try {
    return readJson<Card[]>("cards.json");
  } catch {
    return [];
  }
}

function saveCardsRaw(cards: Card[]) {
  writeJson("cards.json", cards);
}

function withDefaultCardType<T extends { cardType?: CardType | string }>(entry: T): T & { cardType: CardType | string } {
  return { ...entry, cardType: entry.cardType ?? "actor" };
}

export function getCharacterPool(): CharacterPortrayal[] {
  return getCharacterPoolRaw().map(withDefaultCardType);
}

export function saveCharacterPool(pool: CharacterPortrayal[]) {
  saveCharacterPoolRaw(pool);
}

/** Pending pool: cards for winners not yet "pushed to pool". Key = winnerId. */
export type PendingPool = Record<string, CharacterPortrayal[]>;

function getPendingPoolRaw(): PendingPool {
  try {
    return readJson<PendingPool>("pendingPool.json");
  } catch {
    return {};
  }
}

function savePendingPoolRaw(pending: PendingPool) {
  writeJson("pendingPool.json", pending);
}

export function getPendingPool(): PendingPool {
  const raw = getPendingPoolRaw();
  const out: PendingPool = {};
  for (const [winnerId, entries] of Object.entries(raw)) {
    if (Array.isArray(entries) && entries.length > 0) {
      out[winnerId] = entries.map((e) => withDefaultCardType(e));
    }
  }
  return out;
}

export function savePendingPool(pending: PendingPool) {
  savePendingPoolRaw(pending);
}

/** Move a winner's pending pool entries into the main character pool. Returns count pushed. */
export function pushPendingToPool(winnerId: string): number {
  const pending = getPendingPoolRaw();
  const entries = pending[winnerId];
  if (!entries?.length) return 0;
  const pool = getCharacterPoolRaw();
  const existingIds = new Set(pool.map((c) => c.characterId));
  const toAdd = entries.filter((e) => !existingIds.has(e.characterId)).map((e) => withDefaultCardType(e));
  if (toAdd.length > 0) {
    saveCharacterPoolRaw([...pool, ...toAdd]);
  }
  delete pending[winnerId];
  savePendingPoolRaw(pending);
  return toAdd.length;
}

/** Update a single entry in the pending pool for a winner. */
export function updatePendingPoolEntry(
  winnerId: string,
  characterId: string,
  updates: Partial<CharacterPortrayal>
): CharacterPortrayal | null {
  const pending = getPendingPoolRaw();
  const entries = pending[winnerId];
  if (!entries?.length) return null;
  const idx = entries.findIndex((c) => c.characterId === characterId);
  if (idx < 0) return null;
  const updated = { ...entries[idx], ...updates };
  entries[idx] = updated;
  savePendingPoolRaw(pending);
  return withDefaultCardType(updated);
}

/** Remove a single entry from the pending pool for a winner. */
export function removePendingPoolEntry(winnerId: string, characterId: string): boolean {
  const pending = getPendingPoolRaw();
  const entries = pending[winnerId];
  if (!entries?.length) return false;
  const filtered = entries.filter((c) => c.characterId !== characterId);
  if (filtered.length === entries.length) return false;
  if (filtered.length === 0) delete pending[winnerId];
  else pending[winnerId] = filtered;
  savePendingPoolRaw(pending);
  return true;
}

/** Add a single entry to the pending pool for a winner (e.g. new character or alt-art before publish). */
export function addPendingPoolEntry(winnerId: string, entry: CharacterPortrayal): void {
  const pending = getPendingPoolRaw();
  const prev = pending[winnerId] ?? [];
  const normalized = withDefaultCardType(entry);
  pending[winnerId] = [...prev, normalized];
  savePendingPoolRaw(pending);
}

/** CharacterIds of legendary cards already owned by any user. Legendaries are 1-of-1 and can't drop again. */
export function getOwnedLegendaryCharacterIds(): Set<string> {
  const cards = getCardsRaw();
  return new Set(cards.filter((c) => c.rarity === "legendary").map((c) => c.characterId));
}

/** Slot ids (base character: altArtOfCharacterId ?? characterId) for which a legendary is already owned. Used so main and alt-art legendaries are 1-of-1 per slot. */
export function getOwnedLegendarySlotIds(): Set<string> {
  const cards = getCardsRaw();
  const pool = getCharacterPool();
  const poolById = new Map(pool.map((c) => [c.characterId, c]));
  const slots = new Set<string>();
  for (const c of cards) {
    if (c.rarity !== "legendary") continue;
    const entry = poolById.get(c.characterId);
    const slot = entry ? (entry.altArtOfCharacterId ?? entry.characterId) : c.characterId;
    slots.add(slot);
  }
  return slots;
}

/** Legendary cards currently held in inventory whose characterId is not in the character pool. */
export function getLegendaryCardsNotInPool(): Card[] {
  const cards = getCardsRaw();
  const poolIds = new Set(getCharacterPool().map((c) => c.characterId));
  return cards
    .filter((c) => c.rarity === "legendary" && !poolIds.has(c.characterId))
    .map((c) => withDefaultCardType(c))
    .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
}

/** All legendary cards currently in inventory, with inPool true/false per card. */
export function getLegendaryCardsInInventory(): (Card & { inPool: boolean })[] {
  const cards = getCardsRaw();
  const poolIds = new Set(getCharacterPool().map((c) => c.characterId));
  return cards
    .filter((c) => c.rarity === "legendary")
    .map((c) => withDefaultCardType(c) as Card & { inPool: boolean })
    .map((c) => ({ ...c, inPool: poolIds.has(c.characterId) }))
    .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
}

/** Pool entries for codex display: character pool plus one entry per legendary characterId not in pool (so 1of1 custom legendaries have a codex slot and can be uploaded). */
export function getCodexPoolEntries(): CharacterPortrayal[] {
  const pool = getCharacterPool();
  const poolIds = new Set(pool.map((c) => c.characterId));
  const legendariesNotInPool = getLegendaryCardsNotInPool();
  const seen = new Set(poolIds);
  const codexOnly: CharacterPortrayal[] = [];
  for (const c of legendariesNotInPool) {
    if (seen.has(c.characterId)) continue;
    seen.add(c.characterId);
    codexOnly.push({
      characterId: c.characterId,
      actorName: c.actorName ?? "",
      characterName: c.characterName ?? "",
      profilePath: c.profilePath ?? "",
      movieTmdbId: c.movieTmdbId ?? 0,
      movieTitle: c.movieTitle ?? "",
      popularity: 0,
      rarity: "legendary",
      cardType: (c.cardType ?? "actor") as CharacterPortrayal["cardType"],
    });
  }
  return [...pool, ...codexOnly];
}

export function getCards(userId: string): Card[] {
  return getCardsRaw()
    .filter((c) => c.userId === userId)
    .map(withDefaultCardType)
    .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime());
}

export function addCard(card: Omit<Card, "id" | "acquiredAt">): Card {
  const cards = getCardsRaw();
  const newCard: Card = {
    ...card,
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    acquiredAt: new Date().toISOString(),
  };
  cards.push(newCard);
  saveCardsRaw(cards);

  // Legendaries are 1-of-1: they stay in the pool so the codex still has a slot (undiscovered until uploaded).
  // Pack/tradeUp already exclude owned legendary slots via getOwnedLegendarySlotIds(), so they won't drop again.

  return newCard;
}

export function getCardById(cardId: string): Card | undefined {
  const card = getCardsRaw().find((c) => c.id === cardId);
  return card ? withDefaultCardType(card) : undefined;
}

export function transferCard(cardId: string, newUserId: string): boolean {
  const cards = getCardsRaw();
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return false;
  cards[idx] = { ...cards[idx], userId: newUserId };
  saveCardsRaw(cards);
  return true;
}

export function updateCard(
  cardId: string,
  updates: Partial<
    Pick<Card, "actorName" | "characterName" | "movieTitle" | "profilePath" | "rarity" | "isFoil" | "finish" | "cardType" | "movieTmdbId">
  >
): Card | undefined {
  const cards = getCardsRaw();
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return undefined;
  cards[idx] = { ...cards[idx], ...updates };
  saveCardsRaw(cards);
  return withDefaultCardType(cards[idx]);
}

export function removeCard(cardId: string): boolean {
  const cards = getCardsRaw();
  const filtered = cards.filter((c) => c.id !== cardId);
  if (filtered.length === cards.length) return false;
  saveCardsRaw(filtered);

  // Remove any marketplace listing for this card
  const listings = getListings();
  const listing = listings.find((l) => l.cardId === cardId);
  if (listing) removeListing(listing.id);
  return true;
}

/** Update all cards with the given characterId to match pool entry changes (e.g. when admin edits pool image). */
export function updateCardsByCharacterId(
  characterId: string,
  updates: Partial<Pick<Card, "actorName" | "characterName" | "movieTitle" | "profilePath" | "rarity" | "finish" | "cardType" | "movieTmdbId">>
): number {
  const cards = getCardsRaw();
  let changed = 0;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].characterId === characterId) {
      cards[i] = { ...cards[i], ...updates };
      changed++;
    }
  }
  if (changed > 0) saveCardsRaw(cards);
  return changed;
}

// ──── Codex Activity Log (tracks add/remove with timestamps for rollback) ────
interface CodexLogEntry {
  userId: string;
  characterId: string;
  variant: "regular" | "holo" | "prismatic" | "darkMatter" | "altart" | "altart_holo" | "boys";
  action: "add" | "remove";
  createdAt: string;
}

function getCodexLogRaw(): CodexLogEntry[] {
  try {
    return readJson<CodexLogEntry[]>("codexActivityLog.json");
  } catch {
    return [];
  }
}

function saveCodexLogRaw(entries: CodexLogEntry[]) {
  writeJson("codexActivityLog.json", entries);
}

function logCodexActivity(userId: string, characterId: string, variant: CodexLogEntry["variant"], action: "add" | "remove") {
  const log = getCodexLogRaw();
  log.push({ userId, characterId, variant, action, createdAt: new Date().toISOString() });
  saveCodexLogRaw(log);
}

/**
 * Backfill the codex activity log for a user (or all users if userId is omitted).
 * Reads the current codex state and creates "add" log entries with the given backfillDate.
 * Existing log entries for the user(s) are preserved; only missing entries are added.
 * Use this to establish a baseline so the rollback tool works for pre-log codex entries.
 */
export function backfillCodexLog(backfillDate: string, userId?: string): number {
  const timestamp = `${backfillDate}T00:00:00.000Z`;
  const log = getCodexLogRaw();
  const existing = new Set(
    log.map((e) => `${e.userId}|${e.characterId}|${e.variant}`)
  );

  let added = 0;

  const userIds = userId
    ? [userId]
    : (() => {
        const ids = new Set<string>();
        for (const data of [
          getCodexUnlocksRaw(),
          getHoloCodexUnlocksRaw(),
          getPrismaticCodexUnlocksRaw(),
          getDarkMatterCodexUnlocksRaw(),
          getAltArtCodexUnlocksRaw(),
          getAltArtHoloCodexUnlocksRaw(),
          getBoysCodexUnlocksRaw(),
        ]) {
          for (const uid of Object.keys(data)) ids.add(uid);
        }
        return Array.from(ids);
      })();

  for (const uid of userIds) {
    const variants: { data: Record<string, string[]>; variant: CodexLogEntry["variant"] }[] = [
      { data: getCodexUnlocksRaw(), variant: "regular" },
      { data: getHoloCodexUnlocksRaw(), variant: "holo" },
      { data: getPrismaticCodexUnlocksRaw(), variant: "prismatic" },
      { data: getDarkMatterCodexUnlocksRaw(), variant: "darkMatter" },
      { data: getAltArtCodexUnlocksRaw(), variant: "altart" },
      { data: getAltArtHoloCodexUnlocksRaw(), variant: "altart_holo" },
      { data: getBoysCodexUnlocksRaw(), variant: "boys" },
    ];

    for (const { data, variant } of variants) {
      const characterIds = Array.isArray(data[uid]) ? data[uid] : [];
      for (const characterId of characterIds) {
        const key = `${uid}|${characterId}|${variant}`;
        if (existing.has(key)) continue;
        log.push({
          userId: uid,
          characterId,
          variant,
          action: "add",
          createdAt: timestamp,
        });
        existing.add(key);
        added++;
      }
    }
  }

  if (added > 0) saveCodexLogRaw(log);
  return added;
}

// ──── Codex (unlock by uploading a card; removes card from collection, legendaries re-enter pool) ────
// Persisted in DATA_DIR (src/data by default, or /data when DATA_DIR env is set).
const CODEX_UNLOCKS_FILE = "codexUnlocks.json";

function getCodexUnlocksRaw(): Record<string, string[]> {
  try {
    return readJson<Record<string, string[]>>(CODEX_UNLOCKS_FILE);
  } catch {
    return {};
  }
}

function saveCodexUnlocksRaw(data: Record<string, string[]>) {
  writeJson(CODEX_UNLOCKS_FILE, data);
}

export function getCodexUnlockedCharacterIds(userId: string): string[] {
  const data = getCodexUnlocksRaw();
  return Array.isArray(data[userId]) ? data[userId] : [];
}

export function addCodexUnlock(userId: string, characterId: string): void {
  const data = getCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  if (list.includes(characterId)) return;
  data[userId] = [...list, characterId];
  saveCodexUnlocksRaw(data);
  logCodexActivity(userId, characterId, "regular", "add");
}

export function removeCodexUnlock(userId: string, characterId: string): void {
  const data = getCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  data[userId] = list.filter((id) => id !== characterId);
  saveCodexUnlocksRaw(data);
}

/** Clear all codex unlocks for all users (admin). */
export function resetCodexUnlocks(): void {
  saveCodexUnlocksRaw({});
}

// ──── Holo Codex (unlock by uploading a foil card to codex; same lock-in behavior as regular codex) ────
const HOLO_CODEX_UNLOCKS_FILE = "holoCodexUnlocks.json";

function getHoloCodexUnlocksRaw(): Record<string, string[]> {
  try {
    return readJson<Record<string, string[]>>(HOLO_CODEX_UNLOCKS_FILE);
  } catch {
    return {};
  }
}

function saveHoloCodexUnlocksRaw(data: Record<string, string[]>) {
  writeJson(HOLO_CODEX_UNLOCKS_FILE, data);
}

export function getCodexUnlockedHoloCharacterIds(userId: string): string[] {
  const data = getHoloCodexUnlocksRaw();
  return Array.isArray(data[userId]) ? data[userId] : [];
}

export function addCodexUnlockHolo(userId: string, characterId: string): void {
  const data = getHoloCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  if (list.includes(characterId)) return;
  data[userId] = [...list, characterId];
  saveHoloCodexUnlocksRaw(data);
  logCodexActivity(userId, characterId, "holo", "add");
}

export function removeCodexUnlockHolo(userId: string, characterId: string): void {
  const data = getHoloCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  data[userId] = list.filter((id) => id !== characterId);
  saveHoloCodexUnlocksRaw(data);
}

/** Clear all holo codex unlocks for all users (admin). */
export function resetHoloCodexUnlocks(): void {
  saveHoloCodexUnlocksRaw({});
}

// ──── Prismatic Codex (unlock by uploading a prismatic card; requires holo slot first) ────
const PRISMATIC_CODEX_UNLOCKS_FILE = "prismaticCodexUnlocks.json";

function getPrismaticCodexUnlocksRaw(): Record<string, string[]> {
  try {
    return readJson<Record<string, string[]>>(PRISMATIC_CODEX_UNLOCKS_FILE);
  } catch {
    return {};
  }
}

function savePrismaticCodexUnlocksRaw(data: Record<string, string[]>) {
  writeJson(PRISMATIC_CODEX_UNLOCKS_FILE, data);
}

export function getCodexUnlockedPrismaticCharacterIds(userId: string): string[] {
  const data = getPrismaticCodexUnlocksRaw();
  return Array.isArray(data[userId]) ? data[userId] : [];
}

export function addCodexUnlockPrismatic(userId: string, characterId: string): void {
  const data = getPrismaticCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  if (list.includes(characterId)) return;
  data[userId] = [...list, characterId];
  savePrismaticCodexUnlocksRaw(data);
  logCodexActivity(userId, characterId, "prismatic", "add");
}

export function removeCodexUnlockPrismatic(userId: string, characterId: string): void {
  const data = getPrismaticCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  data[userId] = list.filter((id) => id !== characterId);
  savePrismaticCodexUnlocksRaw(data);
}

export function resetPrismaticCodexUnlocks(): void {
  savePrismaticCodexUnlocksRaw({});
}

// ──── Dark Matter Codex (unlock by uploading a dark matter card; requires prismatic slot first) ────
const DARK_MATTER_CODEX_UNLOCKS_FILE = "darkMatterCodexUnlocks.json";

function getDarkMatterCodexUnlocksRaw(): Record<string, string[]> {
  try {
    return readJson<Record<string, string[]>>(DARK_MATTER_CODEX_UNLOCKS_FILE);
  } catch {
    return {};
  }
}

function saveDarkMatterCodexUnlocksRaw(data: Record<string, string[]>) {
  writeJson(DARK_MATTER_CODEX_UNLOCKS_FILE, data);
}

export function getCodexUnlockedDarkMatterCharacterIds(userId: string): string[] {
  const data = getDarkMatterCodexUnlocksRaw();
  return Array.isArray(data[userId]) ? data[userId] : [];
}

export function addCodexUnlockDarkMatter(userId: string, characterId: string): void {
  const data = getDarkMatterCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  if (list.includes(characterId)) return;
  data[userId] = [...list, characterId];
  saveDarkMatterCodexUnlocksRaw(data);
  logCodexActivity(userId, characterId, "darkMatter", "add");
}

export function removeCodexUnlockDarkMatter(userId: string, characterId: string): void {
  const data = getDarkMatterCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  data[userId] = list.filter((id) => id !== characterId);
  saveDarkMatterCodexUnlocksRaw(data);
}

export function resetDarkMatterCodexUnlocks(): void {
  saveDarkMatterCodexUnlocksRaw({});
}

// ──── Alt-Art Codex (unlock by uploading an alt-art card; same lock-in behavior) ────
const ALTART_CODEX_UNLOCKS_FILE = "altArtCodexUnlocks.json";
const ALTART_HOLO_CODEX_UNLOCKS_FILE = "altArtHoloCodexUnlocks.json";

function getAltArtCodexUnlocksRaw(): Record<string, string[]> {
  try {
    return readJson<Record<string, string[]>>(ALTART_CODEX_UNLOCKS_FILE);
  } catch {
    return {};
  }
}

function saveAltArtCodexUnlocksRaw(data: Record<string, string[]>) {
  writeJson(ALTART_CODEX_UNLOCKS_FILE, data);
}

function getAltArtHoloCodexUnlocksRaw(): Record<string, string[]> {
  try {
    return readJson<Record<string, string[]>>(ALTART_HOLO_CODEX_UNLOCKS_FILE);
  } catch {
    return {};
  }
}

function saveAltArtHoloCodexUnlocksRaw(data: Record<string, string[]>) {
  writeJson(ALTART_HOLO_CODEX_UNLOCKS_FILE, data);
}

export function getCodexUnlockedAltArtCharacterIds(userId: string): string[] {
  const data = getAltArtCodexUnlocksRaw();
  return Array.isArray(data[userId]) ? data[userId] : [];
}

/** Character IDs for alt arts that were uploaded as holo (show holo in codex). */
export function getCodexUnlockedAltArtHoloCharacterIds(userId: string): string[] {
  const data = getAltArtHoloCodexUnlocksRaw();
  return Array.isArray(data[userId]) ? data[userId] : [];
}

export function addCodexUnlockAltArt(userId: string, characterId: string, isHolo?: boolean): void {
  const data = getAltArtCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  if (list.includes(characterId)) {
    if (isHolo) {
      const holoData = getAltArtHoloCodexUnlocksRaw();
      const holoList = Array.isArray(holoData[userId]) ? holoData[userId] : [];
      if (!holoList.includes(characterId)) {
        holoData[userId] = [...holoList, characterId];
        saveAltArtHoloCodexUnlocksRaw(holoData);
        logCodexActivity(userId, characterId, "altart_holo", "add");
      }
    }
    return;
  }
  data[userId] = [...list, characterId];
  saveAltArtCodexUnlocksRaw(data);
  logCodexActivity(userId, characterId, "altart", "add");
  if (isHolo) {
    const holoData = getAltArtHoloCodexUnlocksRaw();
    const holoList = Array.isArray(holoData[userId]) ? holoData[userId] : [];
    holoData[userId] = [...holoList, characterId];
    saveAltArtHoloCodexUnlocksRaw(holoData);
    logCodexActivity(userId, characterId, "altart_holo", "add");
  }
}

export function removeCodexUnlockAltArt(userId: string, characterId: string): void {
  const data = getAltArtCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  data[userId] = list.filter((id) => id !== characterId);
  saveAltArtCodexUnlocksRaw(data);
  const holoData = getAltArtHoloCodexUnlocksRaw();
  const holoList = Array.isArray(holoData[userId]) ? holoData[userId] : [];
  holoData[userId] = holoList.filter((id) => id !== characterId);
  saveAltArtHoloCodexUnlocksRaw(holoData);
}

export function resetAltArtCodexUnlocks(): void {
  saveAltArtCodexUnlocksRaw({});
  saveAltArtHoloCodexUnlocksRaw({});
}

// ──── Boys Codex (unlock by uploading a character-type card; same lock-in behavior) ────
const BOYS_CODEX_UNLOCKS_FILE = "boysCodexUnlocks.json";

function getBoysCodexUnlocksRaw(): Record<string, string[]> {
  try {
    return readJson<Record<string, string[]>>(BOYS_CODEX_UNLOCKS_FILE);
  } catch {
    return {};
  }
}

function saveBoysCodexUnlocksRaw(data: Record<string, string[]>) {
  writeJson(BOYS_CODEX_UNLOCKS_FILE, data);
}

export function getCodexUnlockedBoysCharacterIds(userId: string): string[] {
  const data = getBoysCodexUnlocksRaw();
  return Array.isArray(data[userId]) ? data[userId] : [];
}

export function addCodexUnlockBoys(userId: string, characterId: string): void {
  const data = getBoysCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  if (list.includes(characterId)) return;
  data[userId] = [...list, characterId];
  saveBoysCodexUnlocksRaw(data);
  logCodexActivity(userId, characterId, "boys", "add");
}

export function removeCodexUnlockBoys(userId: string, characterId: string): void {
  const data = getBoysCodexUnlocksRaw();
  const list = Array.isArray(data[userId]) ? data[userId] : [];
  data[userId] = list.filter((id) => id !== characterId);
  saveBoysCodexUnlocksRaw(data);
}

export function resetBoysCodexUnlocks(): void {
  saveBoysCodexUnlocksRaw({});
}

/** Clear all codex unlocks for a single user (used by Prestige Codex). */
export function clearCodexForUser(userId: string): void {
  for (const [getRaw, saveRaw] of [
    [getCodexUnlocksRaw, saveCodexUnlocksRaw] as const,
    [getHoloCodexUnlocksRaw, saveHoloCodexUnlocksRaw] as const,
    [getPrismaticCodexUnlocksRaw, savePrismaticCodexUnlocksRaw] as const,
    [getDarkMatterCodexUnlocksRaw, saveDarkMatterCodexUnlocksRaw] as const,
    [getAltArtCodexUnlocksRaw, saveAltArtCodexUnlocksRaw] as const,
    [getBoysCodexUnlocksRaw, saveBoysCodexUnlocksRaw] as const,
  ]) {
    const data = getRaw();
    delete data[userId];
    saveRaw(data);
  }
}

// ──── Prestige: Prismatic Forge unlock (unlocked after Prestige Codex) ────
const PRESTIGE_PRISMATIC_FORGE_FILE = "prestigePrismaticForge.json";

function getPrestigePrismaticForgeRaw(): Record<string, boolean> {
  try {
    return readJson<Record<string, boolean>>(PRESTIGE_PRISMATIC_FORGE_FILE);
  } catch {
    return {};
  }
}

function savePrestigePrismaticForgeRaw(data: Record<string, boolean>) {
  writeJson(PRESTIGE_PRISMATIC_FORGE_FILE, data);
}

export function getPrismaticForgeUnlocked(userId: string): boolean {
  const data = getPrestigePrismaticForgeRaw();
  return data[userId] === true;
}

export function setPrismaticForgeUnlocked(userId: string, unlocked: boolean): void {
  const data = getPrestigePrismaticForgeRaw();
  if (unlocked) {
    data[userId] = true;
  } else {
    delete data[userId];
  }
  savePrestigePrismaticForgeRaw(data);
}

// ──── Trivia ────────────────────────────────────────────
export interface TriviaAttempt {
  id: string;
  userId: string;
  winnerId: string;
  score: number;
  correctCount: number;
  totalCount: number;
  creditsEarned: number;
  completedAt: string;
}

function getTriviaAttemptsRaw(): TriviaAttempt[] {
  try {
    return readJson<TriviaAttempt[]>("triviaAttempts.json");
  } catch {
    return [];
  }
}

function saveTriviaAttemptsRaw(attempts: TriviaAttempt[]) {
  writeJson("triviaAttempts.json", attempts);
}

export function getTriviaAttempts(userId: string): TriviaAttempt[] {
  return getTriviaAttemptsRaw()
    .filter((a) => a.userId === userId)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export function getTriviaAttemptsForWinner(userId: string, winnerId: string): TriviaAttempt[] {
  return getTriviaAttemptsRaw().filter(
    (a) => a.userId === userId && a.winnerId === winnerId
  );
}

export function saveTriviaAttempt(attempt: TriviaAttempt) {
  const attempts = getTriviaAttemptsRaw();
  attempts.push(attempt);
  saveTriviaAttemptsRaw(attempts);
}

/** Remove all trivia attempts for a user+winner (reopen trivia for that user). Returns number removed. */
export function removeTriviaAttemptsForUserAndWinner(userId: string, winnerId: string): number {
  const attempts = getTriviaAttemptsRaw();
  const before = attempts.length;
  const filtered = attempts.filter(
    (a) => !(a.userId === userId && a.winnerId === winnerId)
  );
  if (filtered.length < before) {
    saveTriviaAttemptsRaw(filtered);
    return before - filtered.length;
  }
  return 0;
}

/** Remove all trivia attempts for all users (reopen all trivia). Returns number removed. */
export function removeAllTriviaAttempts(): number {
  const attempts = getTriviaAttemptsRaw();
  const count = attempts.length;
  if (count > 0) {
    saveTriviaAttemptsRaw([]);
    return count;
  }
  return 0;
}

export interface TriviaSession {
  userId: string;
  winnerId: string;
  questions: { id: string; question: string; options: string[]; correctIndex: number }[];
  createdAt: string;
}

function getTriviaSessionsRaw(): TriviaSession[] {
  try {
    return readJson<TriviaSession[]>("triviaSessions.json");
  } catch {
    return [];
  }
}

function saveTriviaSessionsRaw(sessions: TriviaSession[]) {
  writeJson("triviaSessions.json", sessions);
}

const TRIVIA_SESSION_TTL_MS = 10 * 60 * 1000; // 10 min

export function saveTriviaSession(session: TriviaSession) {
  const sessions = getTriviaSessionsRaw().filter((s) => {
    const age = Date.now() - new Date(s.createdAt).getTime();
    return age < TRIVIA_SESSION_TTL_MS;
  });
  sessions.push(session);
  saveTriviaSessionsRaw(sessions);
}

export function getAndConsumeTriviaSession(userId: string, winnerId: string): TriviaSession | null {
  const sessions = getTriviaSessionsRaw();
  const idx = sessions.findIndex(
    (s) => s.userId === userId && s.winnerId === winnerId
  );
  if (idx < 0) return null;
  const session = sessions[idx];
  const age = Date.now() - new Date(session.createdAt).getTime();
  if (age >= TRIVIA_SESSION_TTL_MS) return null;
  sessions.splice(idx, 1);
  saveTriviaSessionsRaw(sessions);
  return session;
}

// ──── Blackjack sessions ─────────────────────────────────
export interface BlackjackCard {
  suit: string;
  rank: string;
}

export interface BlackjackSession {
  userId: string;
  deck: BlackjackCard[];
  playerHand: BlackjackCard[];
  /** When split: array of hands; otherwise derived from playerHand */
  playerHands?: BlackjackCard[][];
  dealerHand: BlackjackCard[];
  bet: number;
  /** Insurance bet (half of main bet); pays 2:1 if dealer has blackjack */
  insurance?: number;
  status: "dealing" | "insurance" | "player_turn" | "dealer_turn" | "resolved";
  /** Index of hand being played when split */
  currentHandIndex?: number;
  result?: "win" | "loss" | "push";
  payout?: number;
  createdAt: string;
}

function getBlackjackSessionsRaw(): BlackjackSession[] {
  try {
    return readJson<BlackjackSession[]>("blackjackSessions.json");
  } catch {
    return [];
  }
}

function saveBlackjackSessionsRaw(sessions: BlackjackSession[]) {
  writeJson("blackjackSessions.json", sessions);
}

const BLACKJACK_SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

export function getBlackjackSession(userId: string): BlackjackSession | null {
  const sessions = getBlackjackSessionsRaw();
  const session = sessions.find((s) => s.userId === userId);
  if (!session) return null;
  const age = Date.now() - new Date(session.createdAt).getTime();
  if (age >= BLACKJACK_SESSION_TTL_MS) return null;
  return session;
}

export function saveBlackjackSession(session: BlackjackSession): void {
  const sessions = getBlackjackSessionsRaw().filter((s) => s.userId !== session.userId);
  sessions.push(session);
  saveBlackjackSessionsRaw(sessions);
}

export function removeBlackjackSession(userId: string): boolean {
  const sessions = getBlackjackSessionsRaw().filter((s) => s.userId !== userId);
  if (sessions.length === getBlackjackSessionsRaw().length) return false;
  saveBlackjackSessionsRaw(sessions);
  return true;
}

// ──── Dabys Bets (sports-style events) ───────────────────
export interface DabysBetsEvent {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  oddsA: number;
  oddsB: number;
  minBet: number;
  maxBet: number;
  isActive: boolean;
  createdAt: string;
}

function getDabysBetsEventsRaw(): DabysBetsEvent[] {
  try {
    return readJson<DabysBetsEvent[]>("dabysBetsEvents.json");
  } catch {
    return [];
  }
}

function saveDabysBetsEventsRaw(events: DabysBetsEvent[]) {
  writeJson("dabysBetsEvents.json", events);
}

export function getDabysBetsEvents(activeOnly = false): DabysBetsEvent[] {
  const events = getDabysBetsEventsRaw();
  if (activeOnly) return events.filter((e) => e.isActive);
  return events;
}

export function getDabysBetsEvent(id: string): DabysBetsEvent | undefined {
  return getDabysBetsEventsRaw().find((e) => e.id === id);
}

export function addDabysBetsEvent(
  input: Omit<DabysBetsEvent, "id" | "createdAt">
): DabysBetsEvent {
  const events = getDabysBetsEventsRaw();
  const now = new Date().toISOString();
  const newEvent: DabysBetsEvent = {
    ...input,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
  };
  events.push(newEvent);
  saveDabysBetsEventsRaw(events);
  return newEvent;
}

export function updateDabysBetsEvent(
  id: string,
  updates: Partial<Omit<DabysBetsEvent, "id" | "createdAt">>
): DabysBetsEvent | undefined {
  const events = getDabysBetsEventsRaw();
  const idx = events.findIndex((e) => e.id === id);
  if (idx < 0) return undefined;
  events[idx] = { ...events[idx], ...updates };
  saveDabysBetsEventsRaw(events);
  return events[idx];
}

export function deleteDabysBetsEvent(id: string): boolean {
  const events = getDabysBetsEventsRaw().filter((e) => e.id !== id);
  if (events.length === getDabysBetsEventsRaw().length) return false;
  saveDabysBetsEventsRaw(events);
  return true;
}

// ──── Casino Game Settings (Slots, Blackjack, Roulette) ───
const SLOT_SYMBOL_KEYS = ["7", "BAR", "star", "bell", "cherry"] as const;

export interface CasinoGameSettings {
  slots: {
    minBet: number;
    maxBet: number;
    validBets: number[];
    /** 3-of-a-kind multiplier per symbol. Lower = higher house edge. */
    paytable: Record<string, number>;
    /** 2-of-a-kind multiplier (same for all). */
    paytable2oak: number;
  };
  blackjack: {
    minBet: number;
    maxBet: number;
    /** Blackjack payout multiplier. 1.5 = 3:2, 1.2 = 6:5. */
    blackjackPayout: number;
  };
  roulette: {
    minBet: number;
    maxBet: number;
    betStep: number;
    /** Red/Black payout multiplier. 2 = even money. */
    colorPayout: number;
    /** Straight up (single number) payout multiplier. 35 = 35:1. */
    straightPayout: number;
  };
}

const DEFAULT_SLOTS_PAYTABLE: Record<string, number> = {
  "7": 43,
  BAR: 21,
  star: 13,
  bell: 9,
  cherry: 4,
};

const DEFAULT_CASINO_GAME_SETTINGS: CasinoGameSettings = {
  slots: {
    minBet: 5,
    maxBet: 100,
    validBets: [5, 10, 25, 50, 100],
    paytable: { ...DEFAULT_SLOTS_PAYTABLE },
    paytable2oak: 0.25,
  },
  blackjack: {
    minBet: 2,
    maxBet: 500,
    blackjackPayout: 1.5,
  },
  roulette: {
    minBet: 5,
    maxBet: 500,
    betStep: 5,
    colorPayout: 2,
    straightPayout: 35,
  },
};

function parsePaytable(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SLOTS_PAYTABLE };
  const out: Record<string, number> = {};
  for (const k of SLOT_SYMBOL_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "number" && v >= 0) out[k] = Math.floor(v);
    else out[k] = DEFAULT_SLOTS_PAYTABLE[k] ?? 4;
  }
  return out;
}

function getCasinoGameSettingsRaw(): CasinoGameSettings {
  try {
    const raw = readJson<Partial<CasinoGameSettings>>("casinoGameSettings.json");
    const slots = raw.slots;
    const blackjack = raw.blackjack;
    const roulette = raw.roulette;
    return {
      slots: {
        minBet: typeof slots?.minBet === "number" && slots.minBet >= 1 ? slots.minBet : DEFAULT_CASINO_GAME_SETTINGS.slots.minBet,
        maxBet: typeof slots?.maxBet === "number" && slots.maxBet >= 1 ? slots.maxBet : DEFAULT_CASINO_GAME_SETTINGS.slots.maxBet,
        validBets: Array.isArray(slots?.validBets) && slots.validBets.length > 0
          ? slots.validBets.filter((v): v is number => typeof v === "number" && v >= 1).sort((a, b) => a - b)
          : DEFAULT_CASINO_GAME_SETTINGS.slots.validBets,
        paytable: parsePaytable(slots?.paytable),
        paytable2oak: typeof slots?.paytable2oak === "number" && slots.paytable2oak >= 0 ? slots.paytable2oak : DEFAULT_CASINO_GAME_SETTINGS.slots.paytable2oak,
      },
      blackjack: {
        minBet: typeof blackjack?.minBet === "number" && blackjack.minBet >= 2 && blackjack.minBet % 2 === 0 ? blackjack.minBet : DEFAULT_CASINO_GAME_SETTINGS.blackjack.minBet,
        maxBet: typeof blackjack?.maxBet === "number" && blackjack.maxBet >= 2 && blackjack.maxBet % 2 === 0 ? blackjack.maxBet : DEFAULT_CASINO_GAME_SETTINGS.blackjack.maxBet,
        blackjackPayout: typeof blackjack?.blackjackPayout === "number" && blackjack.blackjackPayout >= 1 && blackjack.blackjackPayout <= 3 ? blackjack.blackjackPayout : DEFAULT_CASINO_GAME_SETTINGS.blackjack.blackjackPayout,
      },
      roulette: {
        minBet: typeof roulette?.minBet === "number" && roulette.minBet >= 1 ? roulette.minBet : DEFAULT_CASINO_GAME_SETTINGS.roulette.minBet,
        maxBet: typeof roulette?.maxBet === "number" && roulette.maxBet >= 1 ? roulette.maxBet : DEFAULT_CASINO_GAME_SETTINGS.roulette.maxBet,
        betStep: typeof roulette?.betStep === "number" && roulette.betStep >= 1 ? roulette.betStep : DEFAULT_CASINO_GAME_SETTINGS.roulette.betStep,
        colorPayout: typeof roulette?.colorPayout === "number" && roulette.colorPayout >= 1 && roulette.colorPayout <= 10 ? roulette.colorPayout : DEFAULT_CASINO_GAME_SETTINGS.roulette.colorPayout,
        straightPayout: typeof roulette?.straightPayout === "number" && roulette.straightPayout >= 10 && roulette.straightPayout <= 50 ? roulette.straightPayout : DEFAULT_CASINO_GAME_SETTINGS.roulette.straightPayout,
      },
    };
  } catch {
    return DEFAULT_CASINO_GAME_SETTINGS;
  }
}

function saveCasinoGameSettingsRaw(settings: CasinoGameSettings) {
  writeJson("casinoGameSettings.json", settings);
}

export function getCasinoGameSettings(): CasinoGameSettings {
  return getCasinoGameSettingsRaw();
}

export function saveCasinoGameSettings(settings: CasinoGameSettings): void {
  saveCasinoGameSettingsRaw(settings);
}

// ──── Weekly Lottery ──────────────────────────────────────
const DEFAULT_SCRATCH_OFF_PAYTABLE: Record<string, number> = {
  JACKPOT: 50,
  DIAMOND: 20,
  GOLD: 10,
  STAR: 5,
  CLOVER: 3,
  LUCKY: 1,
};

const DEFAULT_SCRATCH_OFF_ODDS: Record<string, number> = {
  JACKPOT: 200,
  DIAMOND: 100,
  GOLD: 50,
  STAR: 25,
  CLOVER: 15,
  LUCKY: 10,
};

export interface ScratchOffSettings {
  cost: number;
  /** Max scratch-off tickets per user per day (UTC). Default 20. */
  dailyLimit?: number;
  /** Match 3+ of same symbol = win. Multiplier per symbol. */
  paytable: Record<string, number>;
  /** Per-symbol win chance: 1 in N. Higher = rarer. P(win) = sum(1/denom). Losing tickets show symbols but no 3+ match. */
  winChanceDenom: Record<string, number>;
}

export interface LotterySettings {
  ticketCost: number;
  startingPool: number;
  /** 0–100: house keeps this % of prize pool; winner gets the rest. 0 = winner gets full pool. */
  houseTakePercent: number;
  scratchOff: ScratchOffSettings;
}

const DEFAULT_SCRATCH_OFF: ScratchOffSettings = {
  cost: 10,
  dailyLimit: 20,
  paytable: { ...DEFAULT_SCRATCH_OFF_PAYTABLE },
  winChanceDenom: { ...DEFAULT_SCRATCH_OFF_ODDS },
};

const DEFAULT_LOTTERY_SETTINGS: LotterySettings = {
  ticketCost: 25,
  startingPool: 0,
  houseTakePercent: 0,
  scratchOff: DEFAULT_SCRATCH_OFF,
};

function parseScratchOffPaytable(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCRATCH_OFF_PAYTABLE };
  const out: Record<string, number> = {};
  for (const k of ["JACKPOT", "DIAMOND", "GOLD", "STAR", "CLOVER", "LUCKY"]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "number" && v >= 0) out[k] = Math.floor(v);
    else out[k] = DEFAULT_SCRATCH_OFF_PAYTABLE[k] ?? 1;
  }
  return out;
}

function parseScratchOffOdds(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCRATCH_OFF_ODDS };
  const out: Record<string, number> = {};
  for (const k of ["JACKPOT", "DIAMOND", "GOLD", "STAR", "CLOVER", "LUCKY"]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "number" && v >= 1) out[k] = Math.floor(v);
    else out[k] = DEFAULT_SCRATCH_OFF_ODDS[k] ?? 20;
  }
  return out;
}

function getLotterySettingsRaw(): LotterySettings {
  try {
    const raw = readJson<Partial<LotterySettings>>("lotterySettings.json");
    const scratchRaw = raw.scratchOff;
    return {
      ticketCost: typeof raw.ticketCost === "number" && raw.ticketCost >= 1 ? raw.ticketCost : DEFAULT_LOTTERY_SETTINGS.ticketCost,
      startingPool: typeof raw.startingPool === "number" && raw.startingPool >= 0 ? raw.startingPool : DEFAULT_LOTTERY_SETTINGS.startingPool,
      houseTakePercent: typeof raw.houseTakePercent === "number" && raw.houseTakePercent >= 0 && raw.houseTakePercent <= 100 ? raw.houseTakePercent : DEFAULT_LOTTERY_SETTINGS.houseTakePercent,
      scratchOff: {
        cost: typeof scratchRaw?.cost === "number" && scratchRaw.cost >= 1 ? scratchRaw.cost : DEFAULT_SCRATCH_OFF.cost,
        dailyLimit: typeof scratchRaw?.dailyLimit === "number" && scratchRaw.dailyLimit >= 1 ? scratchRaw.dailyLimit : DEFAULT_SCRATCH_OFF.dailyLimit ?? 20,
        paytable: parseScratchOffPaytable(scratchRaw?.paytable),
        winChanceDenom: (() => {
          const wcd = scratchRaw?.winChanceDenom;
          if (wcd && typeof wcd === "object" && !Array.isArray(wcd)) return parseScratchOffOdds(wcd);
          const legacy = (scratchRaw as unknown as Record<string, unknown>);
          if (typeof legacy?.winChanceDenom === "number" && legacy.winChanceDenom >= 1) {
            const d = Math.floor(legacy.winChanceDenom as number);
            return { JACKPOT: d * 10, DIAMOND: d * 5, GOLD: d * 2, STAR: d, CLOVER: Math.max(1, Math.floor(d / 2)), LUCKY: Math.max(1, Math.floor(d / 4)) };
          }
          const bw = legacy?.blankWeight;
          if (typeof bw === "number" && bw >= 0) {
            const d = Math.max(1, Math.floor(bw) + 1);
            return { JACKPOT: d * 10, DIAMOND: d * 5, GOLD: d * 2, STAR: d, CLOVER: Math.max(1, Math.floor(d / 2)), LUCKY: Math.max(1, Math.floor(d / 4)) };
          }
          return DEFAULT_SCRATCH_OFF.winChanceDenom;
        })(),
      },
    };
  } catch {
    return DEFAULT_LOTTERY_SETTINGS;
  }
}

function saveLotterySettingsRaw(settings: LotterySettings) {
  writeJson("lotterySettings.json", settings);
}

// ──── Scratch-off claims (credits added when win is revealed) ────
function getScratchOffClaimsRaw(): Record<string, { userId: string; payout: number }> {
  try {
    return readJson<Record<string, { userId: string; payout: number }>>("scratchOffClaims.json");
  } catch {
    return {};
  }
}

function saveScratchOffClaimsRaw(claims: Record<string, { userId: string; payout: number }>) {
  writeJson("scratchOffClaims.json", claims);
}

export function createScratchOffClaim(userId: string, payout: number): string {
  const claims = getScratchOffClaimsRaw();
  const key = crypto.randomUUID();
  claims[key] = { userId, payout };
  saveScratchOffClaimsRaw(claims);
  return key;
}

export function claimScratchOffWin(claimKey: string): number | null {
  const claims = getScratchOffClaimsRaw();
  const entry = claims[claimKey];
  if (!entry) return null;
  addCredits(entry.userId, entry.payout, "scratch_off_win", { claimKey, payout: entry.payout });
  delete claims[claimKey];
  saveScratchOffClaimsRaw(claims);
  return entry.payout;
}

export function getLotterySettings(): LotterySettings {
  return getLotterySettingsRaw();
}

export function saveLotterySettings(settings: LotterySettings): void {
  saveLotterySettingsRaw(settings);
}

export interface LotteryTicket {
  id: string;
  drawId: string;
  userId: string;
  userName: string;
  purchasedAt: string;
}

export interface LotteryDraw {
  drawId: string;
  winnerUserId: string | null;
  winnerUserName: string | null;
  prizePool: number;
  ticketCount: number;
  drawnAt: string;
}

function getLotteryTicketsRaw(): LotteryTicket[] {
  try {
    return readJson<LotteryTicket[]>("lotteryTickets.json");
  } catch {
    return [];
  }
}

function saveLotteryTicketsRaw(tickets: LotteryTicket[]) {
  writeJson("lotteryTickets.json", tickets);
}

function getLotteryDrawsRaw(): LotteryDraw[] {
  try {
    return readJson<LotteryDraw[]>("lotteryDraws.json");
  } catch {
    return [];
  }
}

function saveLotteryDrawsRaw(draws: LotteryDraw[]) {
  writeJson("lotteryDraws.json", draws);
}

/** Next Monday at 16:00 UTC (noon Atlantic Standard Time). */
function getNextMondayNoonUtc(): Date {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const dayOfWeek = now.getUTCDay();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  let daysToAdd = (8 - dayOfWeek) % 7;
  if (dayOfWeek === 1 && (hour > 16 || (hour === 16 && minute >= 0))) {
    daysToAdd = 7;
  }
  const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToAdd, 16, 0, 0, 0));
  return nextMonday;
}

/** Draw ID = YYYY-MM-DD of the Monday we're drawing for. */
export function getCurrentDrawId(): string {
  return getNextMondayNoonUtc().toISOString().slice(0, 10);
}

export function getNextDrawAt(): Date {
  return getNextMondayNoonUtc();
}

export function getLotteryTicketsForDraw(drawId: string): LotteryTicket[] {
  return getLotteryTicketsRaw().filter((t) => t.drawId === drawId);
}

/** Returns how many scratch-off tickets the user has purchased today (UTC). */
export function getScratchOffTicketsToday(userId: string): number {
  const ledger = getCreditLedgerRaw();
  const today = new Date().toISOString().slice(0, 10);
  return ledger
    .filter(
      (e) =>
        e.userId === userId &&
        e.reason === "scratch_off" &&
        e.amount < 0 &&
        e.createdAt.startsWith(today)
    )
    .reduce((sum, e) => sum + (typeof e.metadata?.count === "number" ? e.metadata.count : 1), 0);
}

export function getScratchOffDailyLimit(): number {
  const scratch = getLotterySettings().scratchOff;
  const limit = scratch.dailyLimit;
  return typeof limit === "number" && limit >= 1 ? limit : 20;
}

/** Remove all tickets for a draw. Used by admin to reset the current lottery. */
export function clearLotteryTicketsForDraw(drawId: string): number {
  const tickets = getLotteryTicketsRaw().filter((t) => t.drawId !== drawId);
  const removed = getLotteryTicketsRaw().length - tickets.length;
  saveLotteryTicketsRaw(tickets);
  return removed;
}

export function addLotteryTicket(
  drawId: string,
  userId: string,
  userName: string
): LotteryTicket {
  const tickets = getLotteryTicketsRaw();
  const now = new Date().toISOString();
  const ticket: LotteryTicket = {
    id: `lot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    drawId,
    userId,
    userName,
    purchasedAt: now,
  };
  tickets.push(ticket);
  saveLotteryTicketsRaw(tickets);
  return ticket;
}

export function runLotteryDraw(drawId: string): LotteryDraw | null {
  const tickets = getLotteryTicketsRaw().filter((t) => t.drawId === drawId);
  const draws = getLotteryDrawsRaw();
  if (draws.some((d) => d.drawId === drawId)) {
    return draws.find((d) => d.drawId === drawId) ?? null;
  }
  const { ticketCost, startingPool, houseTakePercent } = getLotterySettings();
  const ticketRevenue = tickets.length * ticketCost;
  const grossPool = ticketRevenue + startingPool;
  const houseTake = Math.floor((grossPool * houseTakePercent) / 100);
  const winnerPayout = grossPool - houseTake;
  const now = new Date().toISOString();
  let winnerUserId: string | null = null;
  let winnerUserName: string | null = null;
  if (tickets.length > 0 && winnerPayout > 0) {
    const winnerTicket = tickets[Math.floor(Math.random() * tickets.length)];
    winnerUserId = winnerTicket.userId;
    winnerUserName = winnerTicket.userName;
    addCredits(winnerUserId, winnerPayout, "lottery_win", { drawId, prizePool: winnerPayout });
  }
  const draw: LotteryDraw = {
    drawId,
    winnerUserId,
    winnerUserName,
    prizePool: winnerPayout,
    ticketCount: tickets.length,
    drawnAt: now,
  };
  draws.push(draw);
  saveLotteryDrawsRaw(draws);
  return draw;
}

export function getLotteryDraw(drawId: string): LotteryDraw | undefined {
  return getLotteryDrawsRaw().find((d) => d.drawId === drawId);
}

export function getLatestLotteryDraw(): LotteryDraw | undefined {
  const draws = getLotteryDrawsRaw();
  return draws.length > 0 ? draws[draws.length - 1] : undefined;
}

// ──── User feedback (for Feedback button → admin panel) ───
export interface FeedbackEntry {
  id: string;
  message: string;
  createdAt: string;
  userId?: string;
  userName?: string;
}

function getFeedbackRaw(): FeedbackEntry[] {
  try {
    return readJson<FeedbackEntry[]>("feedback.json");
  } catch {
    return [];
  }
}

function saveFeedbackRaw(entries: FeedbackEntry[]) {
  writeJson("feedback.json", entries);
}

export function getFeedback(): FeedbackEntry[] {
  return [...getFeedbackRaw()].reverse();
}

export function addFeedback(input: { message: string; userId?: string; userName?: string }): FeedbackEntry {
  const entries = getFeedbackRaw();
  const trimmed = input.message.trim();
  if (!trimmed) throw new Error("Message is required");
  const now = new Date().toISOString();
  const entry: FeedbackEntry = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    message: trimmed,
    createdAt: now,
    userId: input.userId,
    userName: input.userName,
  };
  entries.push(entry);
  saveFeedbackRaw(entries);
  return entry;
}

export function deleteFeedback(id: string): boolean {
  const entries = getFeedbackRaw().filter((e) => e.id !== id);
  if (entries.length === getFeedbackRaw().length) return false;
  saveFeedbackRaw(entries);
  return true;
}

// ──── Direct messages (player-to-player) ───
export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  message: string;
  createdAt: string;
}

function getDirectMessagesRaw(): DirectMessage[] {
  try {
    return readJson<DirectMessage[]>("directMessages.json");
  } catch {
    return [];
  }
}

function saveDirectMessagesRaw(entries: DirectMessage[]) {
  writeJson("directMessages.json", entries);
}

export function getDirectMessages(userId: string): DirectMessage[] {
  return getDirectMessagesRaw().filter(
    (m) => m.senderId === userId || m.recipientId === userId
  );
}

export function getConversation(userId: string, otherUserId: string): DirectMessage[] {
  return getDirectMessagesRaw()
    .filter(
      (m) =>
        (m.senderId === userId && m.recipientId === otherUserId) ||
        (m.senderId === otherUserId && m.recipientId === userId)
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function addDirectMessage(input: {
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  message: string;
}): DirectMessage {
  const entries = getDirectMessagesRaw();
  const trimmed = input.message.trim();
  if (!trimmed) throw new Error("Message is required");
  if (!input.senderId || !input.recipientId) throw new Error("Sender and recipient required");
  if (input.senderId === input.recipientId) throw new Error("Cannot message yourself");
  const now = new Date().toISOString();
  const entry: DirectMessage = {
    id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    senderId: input.senderId,
    senderName: input.senderName,
    recipientId: input.recipientId,
    recipientName: input.recipientName,
    message: trimmed,
    createdAt: now,
  };
  entries.push(entry);
  saveDirectMessagesRaw(entries);
  return entry;
}

// ──── Set completion quests (one per winner, claimable once) ───
export interface SetCompletionQuest {
  winnerId: string;
  movieTitle: string;
  reward: number;
  claimed: boolean;
  completedAt: string;
  /** When true, this quest is for completing the holo upgrade of the entire set. */
  isHolo?: boolean;
  /** When true, this quest is for completing the prismatic upgrade of the entire set. */
  isPrismatic?: boolean;
  /** When true, this quest is for completing the dark matter upgrade of the entire set. */
  isDarkMatter?: boolean;
  /** When false, the set was already complete before this quest was added; claim awards 0. Default true. */
  firstCompletion?: boolean;
}

type SetCompletionQuestsStore = Record<string, SetCompletionQuest[]>;

function getSetCompletionQuestsRaw(): SetCompletionQuestsStore {
  try {
    return readJson<SetCompletionQuestsStore>("setCompletionQuests.json");
  } catch {
    return {};
  }
}

function saveSetCompletionQuestsRaw(store: SetCompletionQuestsStore) {
  writeJson("setCompletionQuests.json", store);
}

/** Add a set completion quest for the user if they don't already have one for this winner. Returns true if added. */
export function addSetCompletionQuest(userId: string, winnerId: string, movieTitle: string): boolean {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  if (userQuests.some((q) => q.winnerId === winnerId)) return false;
  const reward = getCreditSettings().setCompletionReward;
  userQuests.push({
    winnerId,
    movieTitle,
    reward,
    claimed: false,
    completedAt: new Date().toISOString(),
    firstCompletion: true,
  });
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  return true;
}

export function getSetCompletionQuests(userId: string): SetCompletionQuest[] {
  const store = getSetCompletionQuestsRaw();
  return store[userId] ?? [];
}

/** Wipe all set completion quests (regular, holo, prismatic, dark matter) for all users. Admin only. */
export function wipeAllSetCompletionQuests(): void {
  saveSetCompletionQuestsRaw({});
}

/** Wipe all set completion quests for a specific user. Admin only. */
export function wipeAllSetCompletionQuestsForUser(userId: string): boolean {
  const store = getSetCompletionQuestsRaw();
  if (!(userId in store)) return false;
  delete store[userId];
  saveSetCompletionQuestsRaw(store);
  return true;
}

/** Wipe set completion quests for a specific user and set (winner). Removes regular, holo, prismatic, and dark matter quests for that winner. Admin only. */
export function wipeSetCompletionQuestForUser(userId: string, winnerId: string): boolean {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  const filtered = userQuests.filter((q) => q.winnerId !== winnerId);
  if (filtered.length === userQuests.length) return false;
  if (filtered.length === 0) {
    delete store[userId];
  } else {
    store[userId] = filtered;
  }
  saveSetCompletionQuestsRaw(store);
  return true;
}

/** Claim a set completion quest. Returns { reward, didClaim }. Reward is 0 if not first completion. */
export function claimSetCompletionQuest(userId: string, winnerId: string): { reward: number; didClaim: boolean } {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  const idx = userQuests.findIndex((q) => q.winnerId === winnerId && !q.claimed && !q.isHolo);
  if (idx < 0) return { reward: 0, didClaim: false };
  const quest = userQuests[idx];
  quest.claimed = true;
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  const reward = quest.firstCompletion === false ? 0 : quest.reward;
  return { reward, didClaim: true };
}

/** Add a holo set completion quest for the user if they don't already have one for this winner. Returns true if added. */
export function addHoloSetCompletionQuest(userId: string, winnerId: string, movieTitle: string): boolean {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  if (userQuests.some((q) => q.winnerId === winnerId && q.isHolo)) return false;
  const reward = getCreditSettings().holoSetCompletionReward;
  userQuests.push({
    winnerId,
    movieTitle,
    reward,
    claimed: false,
    completedAt: new Date().toISOString(),
    isHolo: true,
    firstCompletion: true,
  });
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  return true;
}

/** Claim a holo set completion quest. Returns { reward, didClaim }. Reward is 0 if not first completion. */
export function claimHoloSetCompletionQuest(userId: string, winnerId: string): { reward: number; didClaim: boolean } {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  const idx = userQuests.findIndex((q) => q.winnerId === winnerId && !q.claimed && q.isHolo === true);
  if (idx < 0) return { reward: 0, didClaim: false };
  const quest = userQuests[idx];
  quest.claimed = true;
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  const reward = quest.firstCompletion === false ? 0 : quest.reward;
  return { reward, didClaim: true };
}

/** Add a prismatic set completion quest for the user. Returns true if added. */
export function addPrismaticSetCompletionQuest(userId: string, winnerId: string, movieTitle: string): boolean {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  if (userQuests.some((q) => q.winnerId === winnerId && q.isPrismatic)) return false;
  const reward = getCreditSettings().prismaticSetCompletionReward;
  userQuests.push({
    winnerId,
    movieTitle,
    reward,
    claimed: false,
    completedAt: new Date().toISOString(),
    isPrismatic: true,
    firstCompletion: true,
  });
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  return true;
}

/** Claim a prismatic set completion quest. */
export function claimPrismaticSetCompletionQuest(userId: string, winnerId: string): { reward: number; didClaim: boolean } {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  const idx = userQuests.findIndex((q) => q.winnerId === winnerId && !q.claimed && q.isPrismatic === true);
  if (idx < 0) return { reward: 0, didClaim: false };
  const quest = userQuests[idx];
  quest.claimed = true;
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  const reward = quest.firstCompletion === false ? 0 : quest.reward;
  return { reward, didClaim: true };
}

/** Add a dark matter set completion quest for the user. Returns true if added. */
export function addDarkMatterSetCompletionQuest(userId: string, winnerId: string, movieTitle: string): boolean {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  if (userQuests.some((q) => q.winnerId === winnerId && q.isDarkMatter)) return false;
  const reward = getCreditSettings().darkMatterSetCompletionReward;
  userQuests.push({
    winnerId,
    movieTitle,
    reward,
    claimed: false,
    completedAt: new Date().toISOString(),
    isDarkMatter: true,
    firstCompletion: true,
  });
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  return true;
}

/** Claim a dark matter set completion quest. */
export function claimDarkMatterSetCompletionQuest(userId: string, winnerId: string): { reward: number; didClaim: boolean } {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  const idx = userQuests.findIndex((q) => q.winnerId === winnerId && !q.claimed && q.isDarkMatter === true);
  if (idx < 0) return { reward: 0, didClaim: false };
  const quest = userQuests[idx];
  quest.claimed = true;
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  const reward = quest.firstCompletion === false ? 0 : quest.reward;
  return { reward, didClaim: true };
}

export type SetCompletionTier = "regular" | "holo" | "prismatic" | "darkMatter";

function matchesTier(q: SetCompletionQuest, tier: SetCompletionTier): boolean {
  if (tier === "regular") return !q.isHolo && !q.isPrismatic && !q.isDarkMatter;
  if (tier === "holo") return q.isHolo === true;
  if (tier === "prismatic") return q.isPrismatic === true;
  if (tier === "darkMatter") return q.isDarkMatter === true;
  return false;
}

/** Admin: Set claimed state for a set completion quest. Returns true if updated. */
export function setSetCompletionQuestClaimed(userId: string, winnerId: string, tier: SetCompletionTier, claimed: boolean): boolean {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  const idx = userQuests.findIndex((q) => q.winnerId === winnerId && matchesTier(q, tier));
  if (idx < 0) return false;
  userQuests[idx].claimed = claimed;
  store[userId] = userQuests;
  saveSetCompletionQuestsRaw(store);
  return true;
}

/** Admin: Remove a specific set completion quest (by tier). Returns true if removed. */
export function removeSetCompletionQuestForUserByTier(userId: string, winnerId: string, tier: SetCompletionTier): boolean {
  const store = getSetCompletionQuestsRaw();
  const userQuests = store[userId] ?? [];
  const filtered = userQuests.filter((q) => !(q.winnerId === winnerId && matchesTier(q, tier)));
  if (filtered.length === userQuests.length) return false;
  if (filtered.length === 0) delete store[userId];
  else store[userId] = filtered;
  saveSetCompletionQuestsRaw(store);
  return true;
}

// ──── Marketplace (listings) ─────────────────────────────
export interface Listing {
  id: string;
  cardId: string;
  sellerUserId: string;
  askingPrice: number;
  createdAt: string;
}

function getListingsRaw(): Listing[] {
  try {
    return readJson<Listing[]>("listings.json");
  } catch {
    return [];
  }
}

function saveListingsRaw(listings: Listing[]) {
  writeJson("listings.json", listings);
}

export function getListings(): Listing[] {
  return getListingsRaw();
}

export function addListing(listing: Omit<Listing, "id" | "createdAt">): Listing {
  const listings = getListingsRaw();
  const newListing: Listing = {
    ...listing,
    id: `lst-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  listings.push(newListing);
  saveListingsRaw(listings);
  return newListing;
}

export function removeListing(listingId: string): boolean {
  const listings = getListingsRaw();
  const idx = listings.findIndex((l) => l.id === listingId);
  if (idx < 0) return false;
  listings.splice(idx, 1);
  saveListingsRaw(listings);
  return true;
}

export function getListing(listingId: string): Listing | undefined {
  return getListingsRaw().find((l) => l.id === listingId);
}

// ──── Buy Orders (requests for specific cards; fulfiller transfers in one click) ───
export interface BuyOrder {
  id: string;
  requesterUserId: string;
  characterId: string;
  /** Credits the requester is willing to pay (0 = free/gift). */
  offerPrice: number;
  createdAt: string;
}

function getBuyOrdersRaw(): BuyOrder[] {
  try {
    return readJson<BuyOrder[]>("buyOrders.json");
  } catch {
    return [];
  }
}

function saveBuyOrdersRaw(orders: BuyOrder[]) {
  writeJson("buyOrders.json", orders);
}

export function getBuyOrders(): BuyOrder[] {
  return getBuyOrdersRaw();
}

export function addBuyOrder(order: Omit<BuyOrder, "id" | "createdAt">): BuyOrder {
  const orders = getBuyOrdersRaw();
  const newOrder: BuyOrder = {
    ...order,
    id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  orders.push(newOrder);
  saveBuyOrdersRaw(orders);
  return newOrder;
}

export function removeBuyOrder(orderId: string): boolean {
  const orders = getBuyOrdersRaw();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx < 0) return false;
  orders.splice(idx, 1);
  saveBuyOrdersRaw(orders);
  return true;
}

export function getBuyOrder(orderId: string): BuyOrder | undefined {
  return getBuyOrdersRaw().find((o) => o.id === orderId);
}

// ──── Trades (P2P card offers) ───────────────────────────
export interface TradeOffer {
  id: string;
  initiatorUserId: string;
  initiatorName: string;
  counterpartyUserId: string;
  counterpartyName: string;
  offeredCardIds: string[];
  requestedCardIds: string[];
  /** Credits initiator adds to the trade (0 if omitted for backward compat) */
  offeredCredits?: number;
  /** Credits initiator requests from counterparty (0 if omitted for backward compat) */
  requestedCredits?: number;
  status: "pending" | "accepted" | "denied";
  createdAt: string;
}

export function getTradesRaw(): TradeOffer[] {
  try {
    return readJson<TradeOffer[]>("trades.json");
  } catch {
    return [];
  }
}

function saveTradesRaw(trades: TradeOffer[]) {
  writeJson("trades.json", trades);
}

export function getTradesForUser(userId: string, status?: "pending" | "accepted" | "denied"): TradeOffer[] {
  const trades = getTradesRaw().filter(
    (t) => t.initiatorUserId === userId || t.counterpartyUserId === userId
  );
  if (status) return trades.filter((t) => t.status === status);
  return trades;
}

export function getTradeById(id: string): TradeOffer | undefined {
  return getTradesRaw().find((t) => t.id === id);
}

export function addTrade(trade: Omit<TradeOffer, "id" | "createdAt">): TradeOffer {
  const trades = getTradesRaw();
  const newTrade: TradeOffer = {
    ...trade,
    id: `trd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  trades.push(newTrade);
  saveTradesRaw(trades);
  return newTrade;
}

export function updateTradeStatus(
  tradeId: string,
  status: "pending" | "accepted" | "denied"
): TradeOffer | undefined {
  const trades = getTradesRaw();
  const idx = trades.findIndex((t) => t.id === tradeId);
  if (idx < 0) return undefined;
  trades[idx] = { ...trades[idx], status };
  saveTradesRaw(trades);
  return trades[idx];
}

/** Cancel all pending trades that involve any of the given card IDs (e.g. card was codexed or quicksold). Returns count cancelled. */
export function cancelPendingTradesInvolvingCards(cardIds: string[]): number {
  if (cardIds.length === 0) return 0;
  const idSet = new Set(cardIds);
  const trades = getTradesRaw();
  let cancelled = 0;
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (t.status !== "pending") continue;
    const offered = t.offeredCardIds?.some((c) => idSet.has(c)) ?? false;
    const requested = t.requestedCardIds?.some((c) => idSet.has(c)) ?? false;
    if (offered || requested) {
      trades[i] = { ...t, status: "denied" as const };
      cancelled++;
    }
  }
  if (cancelled > 0) saveTradesRaw(trades);
  return cancelled;
}

// ──── Store Packs (configurable card packs) ──────────────
export interface Pack {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  cardsPerPack: number;
  /** Allowed rarities for cards in this pack. Empty = all rarities. */
  allowedRarities: ("uncommon" | "rare" | "epic" | "legendary")[];
  /** Allowed card types for this pack. Empty = all card types. Includes custom types. */
  allowedCardTypes: (CardType | string)[];
  isActive: boolean;
  /** Max purchases per user per restock window. Omit or 0 = no limit. */
  maxPurchasesPerDay?: number;
  /** If true, pack costs 0 credits. */
  isFree?: boolean;
  /** Restock interval in hours: limit is per user per rolling X-hour window. When set, restockHourUtc/restockMinuteUtc are ignored. */
  restockIntervalHours?: number;
  /** Hour (0–23) UTC when the daily limit resets. Used only when restockIntervalHours is not set. Omit = midnight. */
  restockHourUtc?: number;
  /** Minute (0–59) UTC when the daily limit resets. Used only when restockIntervalHours is not set. Omit = 0. */
  restockMinuteUtc?: number;
  /** If true, show a "Sale" label on the pack in the shop. */
  discounted?: boolean;
  /** When discounted, optional percentage to display (e.g. 20 for "20% off"). 0–100. */
  discountPercent?: number;
  /**
   * Custom rarity drop-rate weights for this pack (percentage chance per tier).
   * Values should sum to 100. If omitted, uses global defaults (1/10/25/64).
   */
  rarityWeights?: {
    legendary: number;
    epic: number;
    rare: number;
    uncommon: number;
  };
  /** When true, cards from this pack can roll Prismatic finish. */
  allowPrismatic?: boolean;
  /** When true, pack shows in shop with "Coming soon" label and cannot be purchased. */
  comingSoon?: boolean;
  /** When true, cards from this pack can roll Dark Matter finish. */
  allowDarkMatter?: boolean;
  /** Prismatic drop chance (0–100). Used when allowPrismatic is true. Default 2. */
  prismaticChance?: number;
  /** Dark Matter drop chance (0–100). Used when allowDarkMatter is true. Default 0.5. */
  darkMatterChance?: number;
  /** Holo drop chance (0–100). If omitted, uses global default (8%). */
  holoChance?: number;
}

export function getPacksRaw(): Pack[] {
  try {
    return readJson<Pack[]>("packs.json");
  } catch {
    return [];
  }
}

function savePacksRaw(packs: Pack[]) {
  writeJson("packs.json", packs);
}

export function getPacks(): Pack[] {
  const packs = getPacksRaw();
  const ALL_RARITIES: ("uncommon" | "rare" | "epic" | "legendary")[] = [
    "uncommon",
    "rare",
    "epic",
    "legendary",
  ];
  const ALL_CARD_TYPE_IDS = getAllowedCardTypeIds();

  return packs.map((p) => ({
    ...p,
    cardsPerPack: typeof p.cardsPerPack === "number" && p.cardsPerPack > 0 ? p.cardsPerPack : 5,
    allowedRarities:
      Array.isArray(p.allowedRarities) && p.allowedRarities.length > 0
        ? (p.allowedRarities.filter((r) => ALL_RARITIES.includes(r)) as Pack["allowedRarities"])
        : ALL_RARITIES,
    allowedCardTypes:
      Array.isArray(p.allowedCardTypes) && p.allowedCardTypes.length > 0
        ? (p.allowedCardTypes.filter((t) => ALL_CARD_TYPE_IDS.includes(String(t))) as Pack["allowedCardTypes"])
        : (ALL_CARD_TYPE_IDS as Pack["allowedCardTypes"]),
    isActive: typeof p.isActive === "boolean" ? p.isActive : true,
    maxPurchasesPerDay:
      typeof (p as Pack).maxPurchasesPerDay === "number" && (p as Pack).maxPurchasesPerDay! > 0
        ? (p as Pack).maxPurchasesPerDay
        : undefined,
    isFree: !!((p as Pack).isFree),
    restockIntervalHours:
      typeof (p as Pack).restockIntervalHours === "number" && (p as Pack).restockIntervalHours! > 0
        ? (p as Pack).restockIntervalHours
        : undefined,
    restockHourUtc: typeof (p as Pack).restockHourUtc === "number" ? (p as Pack).restockHourUtc : undefined,
    restockMinuteUtc: typeof (p as Pack).restockMinuteUtc === "number" ? (p as Pack).restockMinuteUtc : undefined,
    discounted: !!((p as Pack).discounted),
    discountPercent:
      typeof (p as Pack).discountPercent === "number" && (p as Pack).discountPercent! >= 0 && (p as Pack).discountPercent! <= 100
        ? Math.round((p as Pack).discountPercent!)
        : undefined,
    rarityWeights: p.rarityWeights && typeof p.rarityWeights === "object"
      ? (() => {
          const num = (v: unknown, fallback: number) => {
            const n = typeof v === "number" ? v : Number(v);
            return Number.isFinite(n) ? n : fallback;
          };
          return {
            legendary: num(p.rarityWeights!.legendary, 1),
            epic: num(p.rarityWeights!.epic, 10),
            rare: num(p.rarityWeights!.rare, 25),
            uncommon: num(p.rarityWeights!.uncommon, 64),
          };
        })()
      : undefined,
    allowPrismatic: !!(p as Pack).allowPrismatic,
    allowDarkMatter: !!(p as Pack).allowDarkMatter,
    prismaticChance: typeof (p as Pack).prismaticChance === "number" ? Math.min(100, Math.max(0, (p as Pack).prismaticChance!)) : undefined,
    darkMatterChance: typeof (p as Pack).darkMatterChance === "number" ? Math.min(100, Math.max(0, (p as Pack).darkMatterChance!)) : undefined,
    holoChance: typeof (p as Pack).holoChance === "number" ? Math.min(100, Math.max(0, (p as Pack).holoChance!)) : undefined,
  }));
}

export function savePacks(packs: Pack[]): void {
  savePacksRaw(packs);
}

export function upsertPack(
  input: Omit<Pack, "id"> & { id?: string }
): Pack {
  const packs = getPacks();
  if (input.id) {
    const idx = packs.findIndex((p) => p.id === input.id);
    if (idx >= 0) {
      packs[idx] = { ...packs[idx], ...input, id: input.id };
      savePacks(packs);
      return packs[idx];
    }
  }

  const id = input.id || `pack-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const ALL_RARITIES: Pack["allowedRarities"] = ["uncommon", "rare", "epic", "legendary"];
  const ALL_CARD_TYPE_IDS = getAllowedCardTypeIds() as Pack["allowedCardTypes"];
  const newPack: Pack = {
    id,
    name: input.name,
    imageUrl: input.imageUrl,
    price: input.price,
    cardsPerPack: input.cardsPerPack > 0 ? input.cardsPerPack : 5,
    allowedRarities:
      Array.isArray(input.allowedRarities) && input.allowedRarities.length > 0
        ? (input.allowedRarities as Pack["allowedRarities"])
        : ALL_RARITIES,
    allowedCardTypes:
      Array.isArray(input.allowedCardTypes) && input.allowedCardTypes.length > 0
        ? (input.allowedCardTypes.filter((t) => getAllowedCardTypeIds().includes(String(t))) as Pack["allowedCardTypes"])
        : ALL_CARD_TYPE_IDS,
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
    maxPurchasesPerDay:
      typeof (input as Pack).maxPurchasesPerDay === "number" && (input as Pack).maxPurchasesPerDay! > 0
        ? (input as Pack).maxPurchasesPerDay
        : undefined,
    isFree: !!((input as Pack).isFree),
    restockIntervalHours:
      typeof (input as Pack).restockIntervalHours === "number" && (input as Pack).restockIntervalHours! > 0
        ? (input as Pack).restockIntervalHours
        : undefined,
    restockHourUtc: typeof (input as Pack).restockHourUtc === "number" ? (input as Pack).restockHourUtc : undefined,
    restockMinuteUtc: typeof (input as Pack).restockMinuteUtc === "number" ? (input as Pack).restockMinuteUtc : undefined,
    discounted: !!((input as Pack).discounted),
    discountPercent:
      typeof (input as Pack).discountPercent === "number" && (input as Pack).discountPercent! >= 0 && (input as Pack).discountPercent! <= 100
        ? Math.round((input as Pack).discountPercent!)
        : undefined,
    rarityWeights: input.rarityWeights && typeof input.rarityWeights === "object"
      ? {
          legendary: typeof input.rarityWeights.legendary === "number" ? input.rarityWeights.legendary : 1,
          epic: typeof input.rarityWeights.epic === "number" ? input.rarityWeights.epic : 10,
          rare: typeof input.rarityWeights.rare === "number" ? input.rarityWeights.rare : 25,
          uncommon: typeof input.rarityWeights.uncommon === "number" ? input.rarityWeights.uncommon : 64,
        }
      : undefined,
    comingSoon: !!((input as Pack).comingSoon),
    allowPrismatic: !!(input as Pack).allowPrismatic,
    allowDarkMatter: !!(input as Pack).allowDarkMatter,
    prismaticChance: typeof (input as Pack).prismaticChance === "number" ? Math.min(100, Math.max(0, (input as Pack).prismaticChance!)) : undefined,
    darkMatterChance: typeof (input as Pack).darkMatterChance === "number" ? Math.min(100, Math.max(0, (input as Pack).darkMatterChance!)) : undefined,
    holoChance: typeof (input as Pack).holoChance === "number" ? Math.min(100, Math.max(0, (input as Pack).holoChance!)) : undefined,
  };
  packs.push(newPack);
  savePacks(packs);
  return newPack;
}

export function deletePack(id: string): boolean {
  const packs = getPacks();
  const filtered = packs.filter((p) => p.id !== id);
  if (filtered.length === packs.length) return false;
  savePacks(filtered);
  return true;
}

// ──── Unopened Packs (awarded packs kept in inventory until opened) ────
export interface UnopenedPack {
  id: string;
  userId: string;
  packId: string;
  acquiredAt: string;
  /** Source of the pack, e.g. "award" for future awarding mechanic. */
  source?: string;
}

const UNOPENED_PACKS_FILE = "unopenedPacks.json";

function getUnopenedPacksRaw(): UnopenedPack[] {
  try {
    return readJson<UnopenedPack[]>(UNOPENED_PACKS_FILE);
  } catch {
    return [];
  }
}

function saveUnopenedPacksRaw(packs: UnopenedPack[]) {
  writeJson(UNOPENED_PACKS_FILE, packs);
}

export function getUnopenedPacks(userId: string): UnopenedPack[] {
  return getUnopenedPacksRaw().filter((p) => p.userId === userId);
}

export function getUnopenedPackById(id: string): UnopenedPack | undefined {
  return getUnopenedPacksRaw().find((p) => p.id === id);
}

export function addUnopenedPack(
  userId: string,
  packId: string,
  source?: string
): UnopenedPack {
  const packs = getUnopenedPacksRaw();
  const id = `unopened-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const entry: UnopenedPack = {
    id,
    userId,
    packId,
    acquiredAt: new Date().toISOString(),
    source,
  };
  packs.push(entry);
  saveUnopenedPacksRaw(packs);
  return entry;
}

export function removeUnopenedPack(id: string): UnopenedPack | null {
  const packs = getUnopenedPacksRaw();
  const idx = packs.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const [removed] = packs.splice(idx, 1);
  saveUnopenedPacksRaw(packs);
  return removed;
}

/** Reorder packs to match the given packIds (shop display order). */
export function reorderPacks(packIds: string[]): boolean {
  const packs = getPacks();
  if (packIds.length !== packs.length) return false;
  const idSet = new Set(packIds);
  if (idSet.size !== packIds.length) return false;
  const byId = new Map(packs.map((p) => [p.id, p]));
  const reordered: Pack[] = [];
  for (const id of packIds) {
    const p = byId.get(id);
    if (!p) return false;
    reordered.push(p);
  }
  savePacksRaw(reordered);
  return true;
}

// ──── Shop items (Others: badges, skips, etc.) ────────────────────────
export type ShopItemType = "badge" | "skip";

export interface ShopItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  type: ShopItemType;
  /** For type "skip": number of skips granted. Badge items are standalone (no winner). */
  skipAmount?: number;
  isActive: boolean;
  order: number;
}

function getShopItemsRaw(): ShopItem[] {
  try {
    return readJson<ShopItem[]>("shopItems.json");
  } catch {
    return [];
  }
}

function saveShopItemsRaw(items: ShopItem[]) {
  writeJson("shopItems.json", items);
}

export function getShopItems(): ShopItem[] {
  const raw = getShopItemsRaw();
  return raw
    .filter((i) => i && typeof i.id === "string" && (i.type === "badge" || i.type === "skip"))
    .map((i): ShopItem => ({
      id: i.id,
      name: String(i.name || "").trim() || "Unnamed",
      description: typeof i.description === "string" ? i.description.trim() : undefined,
      imageUrl: typeof i.imageUrl === "string" ? i.imageUrl.trim() : undefined,
      price: typeof i.price === "number" && i.price >= 0 ? i.price : 0,
      type: i.type === "skip" ? "skip" : "badge",
      skipAmount: i.type === "skip" && typeof i.skipAmount === "number" && i.skipAmount > 0 ? i.skipAmount : 1,
      isActive: typeof i.isActive === "boolean" ? i.isActive : true,
      order: typeof i.order === "number" ? i.order : 0,
    }))
    .sort((a, b) => a.order - b.order);
}

export function getActiveShopItems(): ShopItem[] {
  return getShopItems().filter((i) => i.isActive);
}

export function upsertShopItem(input: Omit<ShopItem, "id"> & { id?: string }): ShopItem {
  const items = getShopItemsRaw();
  const id = input.id || `shop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const normalized: ShopItem = {
    id,
    name: String(input.name || "").trim() || "Unnamed",
    description: typeof input.description === "string" ? input.description.trim() : undefined,
    imageUrl: typeof input.imageUrl === "string" ? input.imageUrl.trim() : undefined,
    price: typeof input.price === "number" && input.price >= 0 ? input.price : 0,
    type: input.type === "skip" ? "skip" : "badge",
    skipAmount: input.type === "skip" && typeof input.skipAmount === "number" && input.skipAmount > 0 ? input.skipAmount : 1,
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
    order: typeof input.order === "number" ? input.order : items.length,
  };
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx] = normalized;
  } else {
    items.push(normalized);
  }
  saveShopItemsRaw(items);
  return normalized;
}

export function deleteShopItem(id: string): boolean {
  const items = getShopItemsRaw();
  const filtered = items.filter((i) => i.id !== id);
  if (filtered.length === items.length) return false;
  saveShopItemsRaw(filtered);
  return true;
}

export function reorderShopItems(ids: string[]): boolean {
  const items = getShopItemsRaw();
  if (ids.length !== items.length) return false;
  const byId = new Map(items.map((i) => [i.id, i]));
  const reordered: ShopItem[] = ids.map((id, order) => {
    const item = byId.get(id);
    if (!item) return null;
    return { ...item, order };
  }).filter((i): i is ShopItem => i != null);
  if (reordered.length !== items.length) return false;
  saveShopItemsRaw(reordered);
  return true;
}

/** Apply a shop item purchase for a user. Returns true if applied. */
export function applyShopItemPurchase(userId: string, item: ShopItem): boolean {
  const profile = getProfile(userId);
  if (item.type === "badge") {
    const list = profile.purchasedBadges ?? [];
    if (list.some((b) => b.itemId === item.id)) return true; // already has it
    profile.purchasedBadges = [...list, { itemId: item.id, name: item.name, imageUrl: item.imageUrl }];
    saveProfile(profile);
    return true;
  }
  if (item.type === "skip" && (item.skipAmount ?? 0) > 0) {
    profile.bonusSkips = (profile.bonusSkips ?? 0) + (item.skipAmount ?? 1);
    saveProfile(profile);
    return true;
  }
  return false;
}

// ──── Admin wipe (inventory / full server) ────────────────────────────────

const WIPE_CONFIRM_WORD = "WIPE";

/** Per-user inventory wipe: cards, credits, ledger, trivia, listings, trades. Returns counts. */
export function wipeUserInventory(userId: string): {
  cardsRemoved: number;
  listingsRemoved: number;
  tradesRemoved: number;
  triviaAttemptsRemoved: number;
} {
  const cardsRaw = getCardsRaw();
  const userCards = cardsRaw.filter((c) => c.userId === userId);
  const userCardIds = new Set(userCards.map((c) => c.id));

  const listings = getListingsRaw();
  let listingsRemoved = 0;
  for (const l of listings) {
    if (l.sellerUserId === userId || userCardIds.has(l.cardId)) {
      removeListing(l.id);
      listingsRemoved++;
    }
  }

  saveCardsRaw(cardsRaw.filter((c) => c.userId !== userId));
  saveCreditsRaw(getCreditsRaw().filter((c) => c.userId !== userId));
  saveCreditLedgerRaw(getCreditLedgerRaw().filter((e) => e.userId !== userId));
  saveStardustRaw(getStardustRaw().filter((e) => e.userId !== userId));
  savePrismsRaw(getPrismsRaw().filter((e) => e.userId !== userId));

  const attempts = getTriviaAttemptsRaw();
  const attemptsFiltered = attempts.filter((a) => a.userId !== userId);
  const triviaAttemptsRemoved = attempts.length - attemptsFiltered.length;
  saveTriviaAttemptsRaw(attemptsFiltered);

  saveTriviaSessionsRaw(getTriviaSessionsRaw().filter((s) => s.userId !== userId));

  const trades = getTradesRaw();
  const tradesFiltered = trades.filter(
    (t) => t.initiatorUserId !== userId && t.counterpartyUserId !== userId
  );
  const tradesRemoved = trades.length - tradesFiltered.length;
  saveTradesRaw(tradesFiltered);

  const buyOrders = getBuyOrdersRaw();
  const buyOrdersFiltered = buyOrders.filter((o) => o.requesterUserId !== userId);
  const buyOrdersRemoved = buyOrders.length - buyOrdersFiltered.length;
  if (buyOrdersRemoved > 0) saveBuyOrdersRaw(buyOrdersFiltered);

  const unopenedPacks = getUnopenedPacksRaw();
  saveUnopenedPacksRaw(unopenedPacks.filter((p) => p.userId !== userId));

  return {
    cardsRemoved: userCards.length,
    listingsRemoved,
    tradesRemoved,
    triviaAttemptsRemoved,
  };
}

/** Per-user inventory + currency wipe only. Keeps trivia, comments, submissions, codex, etc. */
export function wipeUserInventoryAndCurrencyOnly(userId: string): {
  cardsRemoved: number;
  listingsRemoved: number;
  tradesRemoved: number;
} {
  const cardsRaw = getCardsRaw();
  const userCards = cardsRaw.filter((c) => c.userId === userId);
  const userCardIds = new Set(userCards.map((c) => c.id));

  const listings = getListingsRaw();
  let listingsRemoved = 0;
  for (const l of listings) {
    if (l.sellerUserId === userId || userCardIds.has(l.cardId)) {
      removeListing(l.id);
      listingsRemoved++;
    }
  }

  saveCardsRaw(cardsRaw.filter((c) => c.userId !== userId));
  saveCreditsRaw(getCreditsRaw().filter((c) => c.userId !== userId));
  saveCreditLedgerRaw(getCreditLedgerRaw().filter((e) => e.userId !== userId));
  saveStardustRaw(getStardustRaw().filter((e) => e.userId !== userId));
  savePrismsRaw(getPrismsRaw().filter((e) => e.userId !== userId));

  const trades = getTradesRaw();
  const tradesFiltered = trades.filter(
    (t) => t.initiatorUserId !== userId && t.counterpartyUserId !== userId
  );
  const tradesRemoved = trades.length - tradesFiltered.length;
  saveTradesRaw(tradesFiltered);

  const buyOrders = getBuyOrdersRaw();
  const buyOrdersFiltered = buyOrders.filter((o) => o.requesterUserId !== userId);
  if (buyOrders.length !== buyOrdersFiltered.length) saveBuyOrdersRaw(buyOrdersFiltered);

  const unopenedPacks = getUnopenedPacksRaw();
  saveUnopenedPacksRaw(unopenedPacks.filter((p) => p.userId !== userId));

  return {
    cardsRemoved: userCards.length,
    listingsRemoved,
    tradesRemoved,
  };
}

/** Full server inventory reset: only cards, credits, ledger, trivia, marketplace (listings), trades. Users, weeks, winners, etc. are unchanged. */
export function wipeServer(confirmWord: string): { success: boolean; error?: string } {
  if (confirmWord !== WIPE_CONFIRM_WORD) {
    return { success: false, error: "Confirmation word does not match" };
  }

  writeJson("credits.json", []);
  writeJson("creditLedger.json", []);
  writeJson("stardust.json", []);
  writeJson("prisms.json", []);
  writeJson("cards.json", []);
  writeJson("triviaAttempts.json", []);
  writeJson("triviaSessions.json", []);
  writeJson("listings.json", []);
  writeJson("buyOrders.json", []);
  writeJson("trades.json", []);
  writeJson(UNOPENED_PACKS_FILE, []);

  return { success: true };
}

/** Server-wide inventory + currency reset only. Keeps trivia, comments, submissions, codex, etc. */
export function wipeServerInventoryAndCurrencyOnly(confirmWord: string): { success: boolean; error?: string } {
  if (confirmWord !== WIPE_CONFIRM_WORD) {
    return { success: false, error: "Confirmation word does not match" };
  }

  writeJson("credits.json", []);
  writeJson("creditLedger.json", []);
  writeJson("stardust.json", []);
  writeJson("prisms.json", []);
  writeJson("cards.json", []);
  writeJson("listings.json", []);
  writeJson("buyOrders.json", []);
  writeJson("trades.json", []);
  writeJson(UNOPENED_PACKS_FILE, []);

  return { success: true };
}

export function getWipeConfirmWord(): string {
  return WIPE_CONFIRM_WORD;
}

// ──── Presence / Online Status ─────────────────────────
export interface PresenceEntry {
  userId: string;
  /** ISO timestamp of last heartbeat */
  lastSeen: string;
  /** Whether the user explicitly marked themselves as idle (no interaction for 15 min) */
  idle: boolean;
}

export function getPresenceRaw(): PresenceEntry[] {
  try {
    return readJson<PresenceEntry[]>("presence.json");
  } catch {
    return [];
  }
}

export function savePresenceRaw(entries: PresenceEntry[]) {
  writeJson("presence.json", entries);
}

/**
 * Update a single user's presence heartbeat.
 * Creates or updates the entry for this userId.
 */
export function upsertPresence(userId: string, idle: boolean): PresenceEntry {
  const entries = getPresenceRaw();
  const now = new Date().toISOString();
  const idx = entries.findIndex((e) => e.userId === userId);
  const entry: PresenceEntry = { userId, lastSeen: now, idle };
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  savePresenceRaw(entries);
  return entry;
}

/**
 * Remove a user's presence (on logout / explicit disconnect).
 */
export function removePresence(userId: string) {
  savePresenceRaw(getPresenceRaw().filter((e) => e.userId !== userId));
}

export type OnlineStatus = "online" | "away" | "offline";

// ──── Activity Feed ─────────────────────────────────────
export type ActivityType =
  | "legendary_pull"
  | "set_complete"
  | "trade_complete"
  | "market_sale"
  | "market_order_filled";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  /** ISO timestamp */
  timestamp: string;
  /** User who triggered the activity */
  userId: string;
  userName: string;
  /** Human-readable message */
  message: string;
  /** Extra context (card name, rarity, movie title, etc.) */
  meta?: Record<string, unknown>;
}

const MAX_ACTIVITY_ENTRIES = 100;

export function getActivity(): ActivityEntry[] {
  try {
    return readJson<ActivityEntry[]>("activity.json");
  } catch {
    return [];
  }
}

export function getActivitySince(since: string): ActivityEntry[] {
  const entries = getActivity();
  const sinceMs = new Date(since).getTime();
  return entries.filter((e) => new Date(e.timestamp).getTime() > sinceMs);
}

export function addActivity(
  entry: Omit<ActivityEntry, "id" | "timestamp">
): ActivityEntry {
  const entries = getActivity();
  const full: ActivityEntry = {
    ...entry,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  entries.push(full);
  // Keep only the latest entries
  const trimmed = entries.slice(-MAX_ACTIVITY_ENTRIES);
  writeJson("activity.json", trimmed);
  return full;
}

// ──── Epic/Legendary Timeline (admin: pull, reroll, trade-up, craft) ────
export type EpicLegendarySource = "pull" | "reroll" | "trade_up" | "prismatic_craft";

export interface EpicLegendaryTimelineEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  source: EpicLegendarySource;
  rarity: "epic" | "legendary";
  cardId: string;
  characterName?: string;
  actorName?: string;
  movieTitle?: string;
  packId?: string;
}

function getEpicLegendaryTimelineRaw(): EpicLegendaryTimelineEntry[] {
  try {
    return readJson<EpicLegendaryTimelineEntry[]>("epicLegendaryTimeline.json");
  } catch {
    return [];
  }
}

function saveEpicLegendaryTimelineRaw(entries: EpicLegendaryTimelineEntry[]) {
  writeJson("epicLegendaryTimeline.json", entries);
}

export function addEpicLegendaryTimelineEntry(
  entry: Omit<EpicLegendaryTimelineEntry, "id" | "timestamp">
): EpicLegendaryTimelineEntry {
  const log = getEpicLegendaryTimelineRaw();
  const full: EpicLegendaryTimelineEntry = {
    ...entry,
    id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  log.push(full);
  saveEpicLegendaryTimelineRaw(log);
  return full;
}

export function getEpicLegendaryTimeline(userId?: string): EpicLegendaryTimelineEntry[] {
  const log = getEpicLegendaryTimelineRaw();
  const filtered = userId ? log.filter((e) => e.userId === userId) : log;
  return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Derive status from a presence entry.
 * - online: heartbeat within 60s and not idle
 * - away:   heartbeat within 60s but idle, OR heartbeat 60s-5min old
 * - offline: heartbeat older than 5 min or missing
 */
export function deriveStatus(entry: PresenceEntry | undefined): OnlineStatus {
  if (!entry) return "offline";
  const age = Date.now() - new Date(entry.lastSeen).getTime();
  if (age > 5 * 60_000) return "offline";
  if (age > 60_000) return "away";
  if (entry.idle) return "away";
  return "online";
}

/**
 * Get a map of userId → status for all known users.
 */
export function getAllPresenceStatuses(): Record<string, OnlineStatus> {
  const entries = getPresenceRaw();
  const result: Record<string, OnlineStatus> = {};
  for (const e of entries) {
    result[e.userId] = deriveStatus(e);
  }
  return result;
}

// ──── Notifications ──────────────────────────────────────
export type NotificationType =
  | "marketplace_sold"
  | "buy_order_filled"
  | "comment_reply"
  | "trade_received"
  | "trade_accepted"
  | "trade_denied"
  | "feedback_accepted"
  | "credits_awarded"
  | "new_set_added"
  | "free_packs_restock"
  | "legendary_pull"
  | "set_complete"
  | "trade_complete"
  | "market_sale"
  | "market_order_filled"
  | "card_tracked_by_others";

export interface Notification {
  id: string;
  type: NotificationType;
  /** ISO timestamp */
  timestamp: string;
  /**
   * The user who should see this notification.
   * Use "__global__" for notifications everyone should see.
   */
  targetUserId: string;
  /** Human-readable message */
  message: string;
  /** The user who triggered the notification (for display) */
  actorUserId?: string;
  actorName?: string;
  /** Extra context */
  meta?: Record<string, unknown>;
  /** Per-user read tracking stored separately */
}

const MAX_NOTIFICATIONS = 200;

export function getNotifications(): Notification[] {
  try {
    return readJson<Notification[]>("notifications.json");
  } catch {
    return [];
  }
}

function saveNotifications(notifications: Notification[]) {
  writeJson("notifications.json", notifications);
}

/**
 * Get notifications for a specific user: their personal ones + global ones.
 * Sorted newest-first.
 */
export function getNotificationsForUser(userId: string): Notification[] {
  const all = getNotifications();
  return all
    .filter((n) => n.targetUserId === userId || n.targetUserId === "__global__")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Add a notification (personal or global).
 */
export function addNotification(
  entry: Omit<Notification, "id" | "timestamp">
): Notification {
  const notifications = getNotifications();
  const full: Notification = {
    ...entry,
    id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  notifications.push(full);
  const trimmed = notifications.slice(-MAX_NOTIFICATIONS);
  saveNotifications(trimmed);
  return full;
}

/**
 * Add a notification to every user.
 * Creates one __global__ entry that all users see.
 */
export function addGlobalNotification(
  entry: Omit<Notification, "id" | "timestamp" | "targetUserId">
): Notification {
  return addNotification({ ...entry, targetUserId: "__global__" });
}

// ──── Notification Read Tracking ─────────────────────────
export interface NotificationReadState {
  userId: string;
  /** ISO timestamp – notifications on or before this time are "read" */
  readUpTo: string;
  /** ISO timestamp – notifications on or before this time are cleared (hidden from list) */
  clearedUpTo?: string;
}

export function getNotificationReadStates(): NotificationReadState[] {
  try {
    return readJson<NotificationReadState[]>("notificationReads.json");
  } catch {
    return [];
  }
}

function saveNotificationReadStates(states: NotificationReadState[]) {
  writeJson("notificationReads.json", states);
}

/**
 * Mark all notifications as read for a user (up to now).
 */
export function markNotificationsRead(userId: string): void {
  const states = getNotificationReadStates();
  const idx = states.findIndex((s) => s.userId === userId);
  const now = new Date().toISOString();
  if (idx >= 0) {
    states[idx].readUpTo = now;
  } else {
    states.push({ userId, readUpTo: now });
  }
  saveNotificationReadStates(states);
}

/**
 * Get the "read up to" timestamp for a user.
 */
export function getReadUpTo(userId: string): string | null {
  const states = getNotificationReadStates();
  const entry = states.find((s) => s.userId === userId);
  return entry?.readUpTo ?? null;
}

/**
 * Get the "cleared up to" timestamp for a user (notifications before this are hidden).
 */
export function getClearedUpTo(userId: string): string | null {
  const states = getNotificationReadStates();
  const entry = states.find((s) => s.userId === userId);
  return entry?.clearedUpTo ?? null;
}

/**
 * Clear all notifications for a user (hide them from the list and mark read).
 */
export function clearNotificationsForUser(userId: string): void {
  const states = getNotificationReadStates();
  const now = new Date().toISOString();
  const idx = states.findIndex((s) => s.userId === userId);
  if (idx >= 0) {
    states[idx].readUpTo = now;
    states[idx].clearedUpTo = now;
  } else {
    states.push({ userId, readUpTo: now, clearedUpTo: now });
  }
  saveNotificationReadStates(states);
}

/**
 * Get notifications visible to a user (after clearedUpTo). Sorted newest-first.
 */
export function getVisibleNotificationsForUser(userId: string): Notification[] {
  const all = getNotificationsForUser(userId);
  const clearedUpTo = getClearedUpTo(userId);
  if (!clearedUpTo) return all;
  const clearedMs = new Date(clearedUpTo).getTime();
  return all.filter((n) => new Date(n.timestamp).getTime() > clearedMs);
}

/**
 * Count unread notifications for a user (among visible notifications only).
 */
export function getUnreadNotificationCount(userId: string): number {
  const readUpTo = getReadUpTo(userId);
  const notifications = getVisibleNotificationsForUser(userId);
  if (!readUpTo) return notifications.length;
  const readMs = new Date(readUpTo).getTime();
  return notifications.filter((n) => new Date(n.timestamp).getTime() > readMs).length;
}

// ──── Site Settings (marketplace toggle, etc.) ───────────
export interface SiteSettings {
  marketplaceEnabled: boolean;
}

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  marketplaceEnabled: true,
};

export function getSiteSettings(): SiteSettings {
  try {
    const raw = readJson<Partial<SiteSettings>>("siteSettings.json");
    return {
      marketplaceEnabled:
        typeof raw.marketplaceEnabled === "boolean"
          ? raw.marketplaceEnabled
          : DEFAULT_SITE_SETTINGS.marketplaceEnabled,
    };
  } catch {
    return { ...DEFAULT_SITE_SETTINGS };
  }
}

export function saveSiteSettings(settings: SiteSettings): void {
  writeJson("siteSettings.json", settings);
}

/**
 * Disable marketplace: set flag to false, remove all listings (return cards to owners),
 * and remove all buy orders. Returns counts of removed items.
 */
export function disableMarketplace(): {
  listingsRemoved: number;
  buyOrdersRemoved: number;
} {
  const settings = getSiteSettings();
  settings.marketplaceEnabled = false;
  saveSiteSettings(settings);

  const listings = getListingsRaw();
  const listingsRemoved = listings.length;
  if (listingsRemoved > 0) {
    saveListingsRaw([]);
  }

  const buyOrders = getBuyOrdersRaw();
  const buyOrdersRemoved = buyOrders.length;
  if (buyOrdersRemoved > 0) {
    saveBuyOrdersRaw([]);
  }

  return { listingsRemoved, buyOrdersRemoved };
}

/**
 * Enable marketplace: set flag to true.
 */
export function enableMarketplace(): void {
  const settings = getSiteSettings();
  settings.marketplaceEnabled = true;
  saveSiteSettings(settings);
}

// ──── Trade Block (cards users are willing to trade) ─────
export interface TradeBlockEntry {
  id: string;
  userId: string;
  cardId: string;
  note: string;
  createdAt: string;
}

function getTradeBlockRaw(): TradeBlockEntry[] {
  try {
    return readJson<TradeBlockEntry[]>("tradeBlock.json");
  } catch {
    return [];
  }
}

function saveTradeBlockRaw(entries: TradeBlockEntry[]) {
  writeJson("tradeBlock.json", entries);
}

export function getTradeBlock(): TradeBlockEntry[] {
  return getTradeBlockRaw();
}

export function addTradeBlockEntry(
  entry: Omit<TradeBlockEntry, "id" | "createdAt">
): TradeBlockEntry {
  const entries = getTradeBlockRaw();
  const existing = entries.find(
    (e) => e.userId === entry.userId && e.cardId === entry.cardId
  );
  if (existing) return existing;

  const newEntry: TradeBlockEntry = {
    ...entry,
    id: `tb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  entries.push(newEntry);
  saveTradeBlockRaw(entries);
  return newEntry;
}

export function removeTradeBlockEntry(userId: string, entryId: string): boolean {
  const entries = getTradeBlockRaw();
  const idx = entries.findIndex(
    (e) => e.id === entryId && e.userId === userId
  );
  if (idx < 0) return false;
  entries.splice(idx, 1);
  saveTradeBlockRaw(entries);
  return true;
}

export function getTradeBlockForUser(userId: string): TradeBlockEntry[] {
  return getTradeBlockRaw().filter((e) => e.userId === userId);
}
