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
  featuredCardIds?: string[];       // up to 6 card IDs to showcase
  displayedBadgeWinnerIds?: string[]; // winner IDs whose completion badges to show
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
    return {
      ...found,
      featuredCardIds: found.featuredCardIds ?? [],
      displayedBadgeWinnerIds: found.displayedBadgeWinnerIds ?? [],
    };
  }
  return {
    userId,
    avatarUrl: "",
    bannerUrl: "",
    bio: "",
    skipsUsed: 0,
    featuredCardIds: [],
    displayedBadgeWinnerIds: [],
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

// ──── Trades (P2P card offers) ───────────────────────────
export interface TradeOffer {
  id: string;
  initiatorUserId: string;
  initiatorName: string;
  counterpartyUserId: string;
  counterpartyName: string;
  offeredCardIds: string[];
  requestedCardIds: string[];
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
