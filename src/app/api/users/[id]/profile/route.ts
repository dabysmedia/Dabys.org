import { NextResponse } from "next/server";
import {
  getUsers,
  getProfile,
  saveProfile,
  getSubmissions,
  getWinners,
  getRatings,
  getComments,
  getWeeks,
  getWatchlist,
  getCodexUnlockedCharacterIds,
  getCharacterPool,
} from "@/lib/data";
import { getCompletedWinnerIds, getCompletedHoloWinnerIds } from "@/lib/cards";

// GET /api/users/[id]/profile — full profile + stats + submissions + comments
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const users = getUsers();
  const user = users.find((u) => u.id === id);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = getProfile(id);
  const allSubs = getSubmissions();
  const allWinners = getWinners();
  const allRatings = getRatings();
  const allComments = getComments();
  const allWeeks = getWeeks();

  // User's submissions — combine same movie into one entry with count (how many times this user submitted it)
  const rawUserSubs = allSubs
    .filter((s) => s.userId === id)
    .map((s) => {
      const week = allWeeks.find((w) => w.id === s.weekId);
      return {
        id: s.id,
        movieTitle: s.movieTitle,
        posterUrl: s.posterUrl,
        letterboxdUrl: s.letterboxdUrl,
        year: s.year,
        weekTheme: week?.theme || "",
        weekId: s.weekId,
        createdAt: s.createdAt,
        tmdbId: s.tmdbId,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const movieKey = (s: { tmdbId?: number; movieTitle: string }) =>
    s.tmdbId != null ? `tmdb:${s.tmdbId}` : `title:${s.movieTitle.trim().toLowerCase()}`;
  const byMovie = new Map<string, typeof rawUserSubs>();
  for (const s of rawUserSubs) {
    const key = movieKey(s);
    if (!byMovie.has(key)) byMovie.set(key, []);
    byMovie.get(key)!.push(s);
  }
  const userSubs = Array.from(byMovie.values()).map((group) => {
    const latest = group[0]; // already sorted by createdAt desc
    return {
      id: latest.id,
      movieTitle: latest.movieTitle,
      posterUrl: latest.posterUrl,
      letterboxdUrl: latest.letterboxdUrl,
      year: latest.year,
      weekTheme: latest.weekTheme,
      weekId: latest.weekId,
      createdAt: latest.createdAt,
      submissionCount: group.length,
    };
  });

  // Weeks this user's submission won
  const userWins = allWinners.filter(
    (w) => w.submittedBy === user.name
  );
  const weeksWon = userWins.map((w) => {
    const week = allWeeks.find((wk) => wk.id === w.weekId);
    return {
      winnerId: w.id,
      movieTitle: w.movieTitle,
      posterUrl: w.posterUrl,
      weekTheme: week?.theme || "",
      publishedAt: w.publishedAt,
    };
  });

  // User's ratings — list + compute favourite movie from highest-starred
  const userRatings = allRatings.filter((r) => r.userId === id);
  const userRatingEntries = userRatings
    .map((r) => {
      const winner = allWinners.find((w) => w.id === r.winnerId);
      return {
        id: r.id,
        winnerId: r.winnerId,
        title: winner?.movieTitle || "Unknown",
        posterUrl: winner?.posterUrl || "",
        year: winner?.year || "",
        stars: r.stars,
        thumbsUp: r.thumbsUp,
        createdAt: r.createdAt,
      };
    })
    // Sort greatest to least by stars (then newest first for ties)
    .sort((a, b) => {
      if (b.stars !== a.stars) return b.stars - a.stars;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  let favoriteMovie: {
    title: string;
    posterUrl: string;
    backdropUrl: string;
    year: string;
    winnerId?: string | null;
    letterboxdUrl?: string | null;
    stars?: number | null;
    thumbsUp?: boolean | null;
  } | null = null;

  const favoriteTmdbId = profile.favoriteMovieTmdbId ?? undefined;
  const favoriteSnapshot = profile.favoriteMovieSnapshot ?? undefined;

  if (favoriteTmdbId != null && favoriteSnapshot) {
    const winner = allWinners.find((w) => w.tmdbId === favoriteTmdbId);
    const rating = userRatings.find((r) => {
      const w = allWinners.find((x) => x.id === r.winnerId);
      return w?.tmdbId === favoriteTmdbId;
    });
    favoriteMovie = {
      title: favoriteSnapshot.title || winner?.movieTitle || "Unknown",
      posterUrl: favoriteSnapshot.posterUrl || winner?.posterUrl || "",
      backdropUrl: favoriteSnapshot.backdropUrl || winner?.backdropUrl || "",
      year: favoriteSnapshot.year || winner?.year || "",
      winnerId: winner?.id ?? null,
      letterboxdUrl: favoriteSnapshot.letterboxdUrl ?? null,
      stars: rating?.stars ?? null,
      thumbsUp: rating?.thumbsUp ?? null,
    };
  } else if (userRatings.length > 0) {
    const best = userRatings.reduce((a, b) => (a.stars > b.stars ? a : b));
    const bestWinner = allWinners.find((w) => w.id === best.winnerId);
    if (bestWinner) {
      favoriteMovie = {
        title: bestWinner.movieTitle,
        posterUrl: bestWinner.posterUrl || "",
        backdropUrl: bestWinner.backdropUrl || "",
        year: bestWinner.year || "",
        winnerId: bestWinner.id,
        letterboxdUrl: null,
        stars: best.stars,
        thumbsUp: best.thumbsUp,
      };
    }
  }

  // User's comments (across all winners) — twitter-style timeline
  const userComments = allComments
    .filter((c) => c.userId === id)
    .map((c) => {
      const winner = allWinners.find((w) => w.id === c.winnerId);
      return {
        id: c.id,
        winnerId: c.winnerId,
        movieTitle: winner?.movieTitle || "Unknown",
        moviePosterUrl: winner?.posterUrl || "",
        text: c.text,
        mediaUrl: c.mediaUrl,
        mediaType: c.mediaType,
        createdAt: c.createdAt,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Stats
  const totalSubmissions = userSubs.length;
  const totalWins = weeksWon.length;
  const totalRatings = userRatings.length;
  const totalComments = userComments.length;
  const avgStars =
    userRatings.length > 0
      ? Math.round((userRatings.reduce((sum, r) => sum + r.stars, 0) / userRatings.length) * 10) / 10
      : 0;
  const thumbsUpCount = userRatings.filter((r) => r.thumbsUp).length;
  const thumbsDownCount = userRatings.filter((r) => !r.thumbsUp).length;

  // Skips: earned 1 per win + bonus from shop, minus however many they've used
  const skipsEarned = totalWins;
  const bonusSkips = profile.bonusSkips ?? 0;
  const skipsUsed = profile.skipsUsed || 0;
  const skipsAvailable = Math.max(0, skipsEarned + bonusSkips - skipsUsed);

  const watchlist = getWatchlist(id);

  // Codex cards: discovered entries from character pool (not inventory)
  const codexCharacterIds = getCodexUnlockedCharacterIds(id);
  const pool = getCharacterPool();
  const poolById = new Map(pool.map((e) => [e.characterId, e]));
  const codexCharacterIdsSet = new Set(codexCharacterIds);
  const codexCards = codexCharacterIds
    .map((charId) => poolById.get(charId))
    .filter((e): e is NonNullable<typeof e> => e != null)
    .map((e) => ({
      id: e.characterId,
      rarity: e.rarity,
      isFoil: false,
      actorName: e.actorName ?? "",
      characterName: e.characterName ?? "",
      movieTitle: e.movieTitle ?? "",
      profilePath: e.profilePath ?? "",
      cardType: e.cardType,
    }));

  // Featured cards: subset of codex by profile.featuredCardIds (codex character IDs), order preserved, max 6
  const featuredIds = (profile.featuredCardIds ?? []).filter((charId) => codexCharacterIdsSet.has(charId)).slice(0, 6);
  const featuredCards = featuredIds
    .map((charId) => poolById.get(charId))
    .filter((e): e is NonNullable<typeof e> => e != null)
    .map((e) => ({
      id: e.characterId,
      rarity: e.rarity,
      isFoil: false,
      actorName: e.actorName ?? "",
      characterName: e.characterName ?? "",
      movieTitle: e.movieTitle ?? "",
      profilePath: e.profilePath ?? "",
      cardType: e.cardType,
    }));

  // Completed badges (winner-based + Holo) + purchased movie badges + standalone purchased badges
  const completedWinnerIds = getCompletedWinnerIds(id);
  const completedHoloWinnerIds = getCompletedHoloWinnerIds(id);
  const purchasedBadgeWinnerIds = profile.purchasedBadgeWinnerIds ?? [];
  const purchasedBadges = profile.purchasedBadges ?? [];
  const allDisplayableWinnerIds = [...new Set([...completedWinnerIds, ...purchasedBadgeWinnerIds])];
  const completedBadges = [
    ...allDisplayableWinnerIds.map((wid) => {
      const w = allWinners.find((x) => x.id === wid);
      const isPurchased = purchasedBadgeWinnerIds.includes(wid);
      return {
        winnerId: wid,
        movieTitle: w?.movieTitle ?? "Unknown",
        posterUrl: w?.posterUrl ?? undefined,
        isHolo: !isPurchased && completedHoloWinnerIds.includes(wid),
      };
    }),
    ...purchasedBadges.map((b) => ({
      shopItemId: b.itemId,
      movieTitle: b.name,
      name: b.name,
      imageUrl: b.imageUrl,
      isHolo: false as const,
    })),
  ];

  // Single displayed badge: either a shop standalone badge or a winner badge
  const displayedBadgeShopItemId =
    profile.displayedBadgeShopItemId && purchasedBadges.some((b) => b.itemId === profile.displayedBadgeShopItemId)
      ? profile.displayedBadgeShopItemId
      : null;
  const displayedBadgeWinnerId =
    !displayedBadgeShopItemId &&
    profile.displayedBadgeWinnerId &&
    allDisplayableWinnerIds.includes(profile.displayedBadgeWinnerId)
      ? profile.displayedBadgeWinnerId
      : null;
  const displayedBadge = displayedBadgeShopItemId
    ? (() => {
        const b = purchasedBadges.find((x) => x.itemId === displayedBadgeShopItemId);
        return b
          ? { shopItemId: b.itemId, movieTitle: b.name, name: b.name, imageUrl: b.imageUrl, isHolo: false as const }
          : null;
      })()
    : displayedBadgeWinnerId
      ? (() => {
          const w = allWinners.find((x) => x.id === displayedBadgeWinnerId);
          return {
            winnerId: displayedBadgeWinnerId,
            movieTitle: w?.movieTitle ?? "Unknown",
            isHolo: completedHoloWinnerIds.includes(displayedBadgeWinnerId),
          };
        })()
      : null;

  return NextResponse.json({
    user: { id: user.id, name: user.name },
    hasPin: !!user.pin,
    profile: {
      avatarUrl: profile.avatarUrl,
      bannerUrl: profile.bannerUrl,
      bio: profile.bio,
      featuredCardIds: featuredIds,
      displayedBadgeWinnerId: displayedBadgeWinnerId ?? undefined,
      displayedBadgeShopItemId: displayedBadgeShopItemId ?? undefined,
      favoriteMovieTmdbId: profile.favoriteMovieTmdbId ?? undefined,
      favoriteMovieSnapshot: profile.favoriteMovieSnapshot ?? undefined,
    },
    codexCards,
    featuredCards,
    displayedBadge,
    displayedBadges: displayedBadge ? [displayedBadge] : [],
    completedWinnerIds,
    completedBadges,
    stats: {
      totalSubmissions,
      totalWins,
      totalRatings,
      totalComments,
      avgStars,
      thumbsUpCount,
      thumbsDownCount,
      favoriteMovie,
      skipsEarned,
      skipsUsed,
      skipsAvailable,
    },
    ratings: userRatingEntries,
    submissions: userSubs,
    weeksWon,
    comments: userComments,
    watchlist,
  });
}

// PUT /api/users/[id]/profile — update bio, avatar, banner
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const users = getUsers();
  if (!users.find((u) => u.id === id)) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const profile = getProfile(id);

  if (typeof body.avatarUrl === "string") profile.avatarUrl = body.avatarUrl;
  if (typeof body.bannerUrl === "string") profile.bannerUrl = body.bannerUrl;
  if (typeof body.bio === "string") profile.bio = body.bio.slice(0, 300);
  if (typeof body.skipsUsed === "number") profile.skipsUsed = Math.max(0, Math.floor(body.skipsUsed));

  if (body.displayedBadgeWinnerId !== undefined) {
    const completed = getCompletedWinnerIds(id);
    const purchased = profile.purchasedBadgeWinnerIds ?? [];
    const allowed = new Set([...completed, ...purchased]);
    const value = body.displayedBadgeWinnerId;
    if (value === null || value === "") {
      profile.displayedBadgeWinnerId = undefined;
      profile.displayedBadgeShopItemId = undefined;
    } else if (typeof value === "string" && allowed.has(value)) {
      profile.displayedBadgeWinnerId = value;
      profile.displayedBadgeShopItemId = undefined;
    }
  }
  if (body.favoriteMovieTmdbId !== undefined) {
    if (body.favoriteMovieTmdbId == null || body.favoriteMovieTmdbId === "") {
      profile.favoriteMovieTmdbId = undefined;
      profile.favoriteMovieSnapshot = undefined;
    } else if (
      typeof body.favoriteMovieTmdbId === "number" &&
      body.favoriteMovieSnapshot &&
      typeof body.favoriteMovieSnapshot === "object"
    ) {
      const s = body.favoriteMovieSnapshot as { title?: string; posterUrl?: string; backdropUrl?: string; year?: string; letterboxdUrl?: string };
      profile.favoriteMovieTmdbId = body.favoriteMovieTmdbId;
      profile.favoriteMovieSnapshot = {
        title: typeof s.title === "string" ? s.title.slice(0, 200) : "",
        posterUrl: typeof s.posterUrl === "string" ? s.posterUrl.slice(0, 500) : "",
        backdropUrl: typeof s.backdropUrl === "string" ? s.backdropUrl.slice(0, 500) : "",
        year: typeof s.year === "string" ? s.year.slice(0, 10) : "",
        letterboxdUrl: typeof s.letterboxdUrl === "string" ? s.letterboxdUrl.slice(0, 500) : "",
      };
    }
  }

  if (body.displayedBadgeShopItemId !== undefined) {
    const value = body.displayedBadgeShopItemId;
    const purchased = profile.purchasedBadges ?? [];
    const allowed = new Set(purchased.map((b) => b.itemId));
    if (value === null || value === "") {
      profile.displayedBadgeShopItemId = undefined;
      profile.displayedBadgeWinnerId = undefined;
    } else if (typeof value === "string" && allowed.has(value)) {
      profile.displayedBadgeShopItemId = value;
      profile.displayedBadgeWinnerId = undefined;
    }
  }

  if (Array.isArray(body.featuredCardIds)) {
    const codexIds = new Set(getCodexUnlockedCharacterIds(id));
    profile.featuredCardIds = body.featuredCardIds
      .filter((charId: unknown) => typeof charId === "string" && codexIds.has(charId))
      .slice(0, 6);
  }

  saveProfile(profile);

  return NextResponse.json({ success: true, profile });
}
