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

// ──── Credit Settings (reward amounts, editable in admin) ─
export interface CreditSettings {
  submission: number;
  vote: number;
  submissionWin: number;
  rating: number;
  comment: number;
}

const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  submission: 50,
  vote: 50,
  submissionWin: 250,
  rating: 25,
  comment: 25,
};

function getCreditSettingsRaw(): CreditSettings {
  try {
    const raw = readJson<Partial<CreditSettings>>("creditSettings.json");
    return {
      submission: typeof raw.submission === "number" ? raw.submission : DEFAULT_CREDIT_SETTINGS.submission,
      vote: typeof raw.vote === "number" ? raw.vote : DEFAULT_CREDIT_SETTINGS.vote,
      submissionWin: typeof raw.submissionWin === "number" ? raw.submissionWin : DEFAULT_CREDIT_SETTINGS.submissionWin,
      rating: typeof raw.rating === "number" ? raw.rating : DEFAULT_CREDIT_SETTINGS.rating,
      comment: typeof raw.comment === "number" ? raw.comment : DEFAULT_CREDIT_SETTINGS.comment,
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

function getCreditsRaw(): UserCredit[] {
  try {
    return readJson<UserCredit[]>("credits.json");
  } catch {
    return [];
  }
}

function saveCreditsRaw(credits: UserCredit[]) {
  writeJson("credits.json", credits);
}

function getCreditLedgerRaw(): CreditLedgerEntry[] {
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

/** Number of times the user has purchased this pack in the current restock period (UTC). */
export function getPackPurchasesCountToday(
  userId: string,
  packId: string,
  restock?: { restockHourUtc?: number; restockMinuteUtc?: number }
): number {
  const ledger = getCreditLedgerRaw();
  const periodStart = restock
    ? getRestockPeriodStartUtc(restock.restockHourUtc, restock.restockMinuteUtc)
    : new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
  return ledger.filter(
    (e) =>
      e.userId === userId &&
      e.reason === "pack_purchase" &&
      e.metadata &&
      (e.metadata as { packId?: string }).packId === packId &&
      e.createdAt >= periodStart
  ).length;
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

/** Remove today's pack_purchase ledger entries for this user so they can buy packs again today. Returns number of entries removed. */
export function resetUserPackPurchasesToday(userId: string): number {
  const ledger = getCreditLedgerRaw();
  const today = new Date().toISOString().slice(0, 10);
  const filtered = ledger.filter(
    (e) =>
      !(
        e.userId === userId &&
        e.reason === "pack_purchase" &&
        e.createdAt.startsWith(today)
      )
  );
  const removed = ledger.length - filtered.length;
  if (removed > 0) saveCreditLedgerRaw(filtered);
  return removed;
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

// ──── Stardust (Alchemy) ────────────────────────────────
export interface StardustEntry {
  userId: string;
  balance: number;
  updatedAt: string;
}

function getStardustRaw(): StardustEntry[] {
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

// ──── Card Types (multi-type pool) ───────────────────────
export type CardType = "actor" | "director" | "character" | "scene";

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
  cardType?: CardType; // optional for migration; defaults to "actor"
  /** When set, this pool entry is an alt-art; owning a card with this characterId counts as owning this character for set completion. */
  altArtOfCharacterId?: string;
}

export interface Card {
  id: string;
  userId: string;
  characterId: string;
  rarity: "uncommon" | "rare" | "epic" | "legendary";
  isFoil: boolean;
  actorName: string;
  characterName: string;
  movieTitle: string;
  movieTmdbId: number;
  profilePath: string;
  acquiredAt: string;
  cardType?: CardType; // optional for migration; defaults to "actor"
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

function getCardsRaw(): Card[] {
  try {
    return readJson<Card[]>("cards.json");
  } catch {
    return [];
  }
}

function saveCardsRaw(cards: Card[]) {
  writeJson("cards.json", cards);
}

function withDefaultCardType<T extends { cardType?: CardType }>(entry: T): T & { cardType: CardType } {
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

/** CharacterIds of legendary cards already owned by any user. Legendaries are 1-of-1 and can't drop again. */
export function getOwnedLegendaryCharacterIds(): Set<string> {
  const cards = getCardsRaw();
  return new Set(cards.filter((c) => c.rarity === "legendary").map((c) => c.characterId));
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
    Pick<Card, "actorName" | "characterName" | "movieTitle" | "profilePath" | "rarity" | "isFoil" | "cardType" | "movieTmdbId">
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
  updates: Partial<Pick<Card, "actorName" | "characterName" | "movieTitle" | "profilePath" | "rarity" | "cardType" | "movieTmdbId">>
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
}

/** Clear all codex unlocks for all users (admin). */
export function resetCodexUnlocks(): void {
  saveCodexUnlocksRaw({});
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
  dealerHand: BlackjackCard[];
  bet: number;
  status: "dealing" | "player_turn" | "dealer_turn" | "resolved";
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

function getTradesRaw(): TradeOffer[] {
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

// ──── Store Packs (configurable card packs) ──────────────
export interface Pack {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  cardsPerPack: number;
  /** Allowed rarities for cards in this pack. Empty = all rarities. */
  allowedRarities: ("uncommon" | "rare" | "epic" | "legendary")[];
  /** Allowed card types for this pack. Empty = all card types. */
  allowedCardTypes: CardType[];
  isActive: boolean;
  /** Max purchases per user per day (UTC). Omit or 0 = no limit. */
  maxPurchasesPerDay?: number;
  /** If true, pack costs 0 credits. */
  isFree?: boolean;
  /** Hour (0–23) UTC when the daily limit resets. Omit = midnight. */
  restockHourUtc?: number;
  /** Minute (0–59) UTC when the daily limit resets. Omit = 0. */
  restockMinuteUtc?: number;
}

function getPacksRaw(): Pack[] {
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
  const ALL_CARD_TYPES: CardType[] = ["actor", "director", "character", "scene"];

  return packs.map((p) => ({
    ...p,
    cardsPerPack: typeof p.cardsPerPack === "number" && p.cardsPerPack > 0 ? p.cardsPerPack : 5,
    allowedRarities:
      Array.isArray(p.allowedRarities) && p.allowedRarities.length > 0
        ? (p.allowedRarities.filter((r) => ALL_RARITIES.includes(r)) as Pack["allowedRarities"])
        : ALL_RARITIES,
    allowedCardTypes:
      Array.isArray(p.allowedCardTypes) && p.allowedCardTypes.length > 0
        ? (p.allowedCardTypes.filter((t) => ALL_CARD_TYPES.includes(t)) as Pack["allowedCardTypes"])
        : ALL_CARD_TYPES,
    isActive: typeof p.isActive === "boolean" ? p.isActive : true,
    maxPurchasesPerDay:
      typeof (p as Pack).maxPurchasesPerDay === "number" && (p as Pack).maxPurchasesPerDay! > 0
        ? (p as Pack).maxPurchasesPerDay
        : undefined,
    isFree: !!((p as Pack).isFree),
    restockHourUtc: typeof (p as Pack).restockHourUtc === "number" ? (p as Pack).restockHourUtc : undefined,
    restockMinuteUtc: typeof (p as Pack).restockMinuteUtc === "number" ? (p as Pack).restockMinuteUtc : undefined,
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
  const ALL_CARD_TYPES: Pack["allowedCardTypes"] = ["actor", "director", "character", "scene"];
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
        ? (input.allowedCardTypes as Pack["allowedCardTypes"])
        : ALL_CARD_TYPES,
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
    maxPurchasesPerDay:
      typeof (input as Pack).maxPurchasesPerDay === "number" && (input as Pack).maxPurchasesPerDay! > 0
        ? (input as Pack).maxPurchasesPerDay
        : undefined,
    isFree: !!((input as Pack).isFree),
    restockHourUtc: typeof (input as Pack).restockHourUtc === "number" ? (input as Pack).restockHourUtc : undefined,
    restockMinuteUtc: typeof (input as Pack).restockMinuteUtc === "number" ? (input as Pack).restockMinuteUtc : undefined,
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

  return {
    cardsRemoved: userCards.length,
    listingsRemoved,
    tradesRemoved,
    triviaAttemptsRemoved,
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
  writeJson("cards.json", []);
  writeJson("triviaAttempts.json", []);
  writeJson("triviaSessions.json", []);
  writeJson("listings.json", []);
  writeJson("buyOrders.json", []);
  writeJson("trades.json", []);

  return { success: true };
}

export function getWipeConfirmWord(): string {
  return WIPE_CONFIRM_WORD;
}
