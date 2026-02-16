"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ImageCropModal from "@/components/ImageCropModal";
import { CardDisplay } from "@/components/CardDisplay";
import { BadgePill } from "@/components/BadgePill";
import { RARITY_COLORS } from "@/lib/constants";

interface User {
  id: string;
  name: string;
}

interface Rating {
  id: string;
  winnerId: string;
  userId: string;
  userName: string;
  thumbsUp: boolean;
  stars: number;
  createdAt: string;
}

interface Comment {
  id: string;
  winnerId: string;
  userId: string;
  userName: string;
  text: string;
  mediaUrl: string;
  mediaType: string;
  createdAt: string;
  avatarUrl?: string;
  parentId?: string;
  parentUserName?: string;
  likeCount?: number;
  likedByMe?: boolean;
  displayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean } | null;
}

interface RunnerUp {
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  year?: string;
  userName: string;
  userId: string;
}

interface WinnerDetail {
  id: string;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  submittedBy: string;
  publishedAt: string;
  year?: string;
  overview?: string;
  trailerUrl?: string;
  backdropUrl?: string;
  tmdbId?: number;
  submittedByUserId?: string;
  submitterAvatarUrl?: string;
  submitterDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean } | null;
  weekTheme?: string;
  runnerUps?: RunnerUp[];
  ratings: Rating[];
  comments: Comment[];
  stats: {
    thumbsUp: number;
    thumbsDown: number;
    avgStars: number;
    totalRatings: number;
    totalComments: number;
    dabysScorePct?: number;
  };
}

/** Parse GIPHY ID from giphy.com share/embed URLs (https://giphy.com) */
function getGiphyEmbedUrl(pasted: string): string | null {
  const u = pasted.trim();
  if (!u.includes("giphy.com")) return null;
  let id: string | null = null;
  const embedMatch = u.match(/giphy\.com\/embed\/([a-zA-Z0-9]+)/);
  if (embedMatch) id = embedMatch[1];
  else {
    const gifsMatch = u.match(/giphy\.com\/gifs\/[^/]+\/([a-zA-Z0-9]+)/);
    if (gifsMatch) id = gifsMatch[1];
    else {
      const mediaMatch = u.match(/media\.giphy\.com\/media\/([a-zA-Z0-9]+)/);
      if (mediaMatch) id = mediaMatch[1];
      else {
        const pathMatch = u.match(/giphy\.com\/[^/]+\/([a-zA-Z0-9]{6,})/);
        if (pathMatch) id = pathMatch[1];
      }
    }
  }
  return id ? `https://giphy.com/embed/${id}` : null;
}

export default function WinnerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const winnerId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [winner, setWinner] = useState<WinnerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Rating state
  const [myThumb, setMyThumb] = useState<boolean | null>(null);
  const [myStars, setMyStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaIsGiphy, setMediaIsGiphy] = useState(false);
  const [showGiphyBrowser, setShowGiphyBrowser] = useState(false);
  const [giphySearchQuery, setGiphySearchQuery] = useState("");
  const [giphyResults, setGiphyResults] = useState<{ id: string; embedUrl: string; thumbnail: string; title: string }[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [noGiphyKey, setNoGiphyKey] = useState(false);
  const [giphyPasteUrl, setGiphyPasteUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; userName: string } | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState("");
  const giphySearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trivia
  const [triviaCompleted, setTriviaCompleted] = useState(false);
  const [showTrivia, setShowTrivia] = useState(false);
  const [triviaQuestions, setTriviaQuestions] = useState<{ id: string; question: string; options: string[]; correctIndex: number }[]>([]);
  const [triviaLoading, setTriviaLoading] = useState(false);
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [triviaAnswers, setTriviaAnswers] = useState<{ questionId: string; selectedIndex: number }[]>([]);
  const [triviaSubmitting, setTriviaSubmitting] = useState(false);
  const [triviaResult, setTriviaResult] = useState<{ correctCount: number; totalCount: number; creditsEarned: number } | null>(null);

  // Card set for this movie
  const [winnerCollection, setWinnerCollection] = useState<{
    poolEntries: { characterId: string; profilePath: string; actorName: string; characterName: string; movieTitle: string; rarity: string; movieTmdbId: number }[];
    ownedCharacterIds: string[];
    ownedCards: { id: string; characterId: string; profilePath: string; actorName: string; characterName: string; movieTitle: string; rarity: string; isFoil: boolean; cardType?: string }[];
    completed: boolean;
  } | null>(null);

  // Pinned/tracked winners for TCG badge progress (max 3, stored in localStorage)
  const TRACKED_KEY = "tcg-tracked-winner-ids";
  const [trackedWinnerIds, setTrackedWinnerIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRACKED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setTrackedWinnerIds(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
    } catch { setTrackedWinnerIds([]); }
  }, []);
  const isTracked = trackedWinnerIds.includes(winnerId);
  const canTrack = trackedWinnerIds.length < 3;
  function toggleTrack() {
    if (isTracked) {
      const next = trackedWinnerIds.filter((id) => id !== winnerId);
      setTrackedWinnerIds(next);
      localStorage.setItem(TRACKED_KEY, JSON.stringify(next));
    } else if (canTrack) {
      const next = [...trackedWinnerIds, winnerId].slice(0, 3);
      setTrackedWinnerIds(next);
      localStorage.setItem(TRACKED_KEY, JSON.stringify(next));
    }
  }

  const loadWinner = useCallback(async () => {
    try {
      const cached = localStorage.getItem("dabys_user");
      const u = cached ? JSON.parse(cached) as User : null;
      const url = u?.id ? `/api/winners/${winnerId}?userId=${encodeURIComponent(u.id)}` : `/api/winners/${winnerId}`;
      const res = await fetch(url);
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const data: WinnerDetail = await res.json();
      setWinner(data);

      // Check if user already rated
      if (u) {
        const existingRating = data.ratings.find((r) => r.userId === u.id);
        if (existingRating) {
          setMyThumb(existingRating.thumbsUp);
          setMyStars(existingRating.stars);
          setRatingSubmitted(true);
        }
        // Check if trivia already completed for this winner
        if (data.tmdbId) {
          try {
            const attRes = await fetch(`/api/trivia/attempts?userId=${encodeURIComponent(u.id)}&winnerId=${winnerId}`);
            if (attRes.ok) {
              const attData = await attRes.json();
              if (attData.attempts?.length > 0) setTriviaCompleted(true);
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [winnerId, router]);

  // Fetch card set when winner has tmdbId
  useEffect(() => {
    if (!winner?.tmdbId) {
      setWinnerCollection(null);
      return;
    }
    const cached = localStorage.getItem("dabys_user");
    const u = cached ? JSON.parse(cached) as User : null;
    const url = `/api/cards/winner-collection?winnerId=${encodeURIComponent(winnerId)}${u?.id ? `&userId=${encodeURIComponent(u.id)}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then(setWinnerCollection)
      .catch(() => setWinnerCollection(null));
  }, [winner?.tmdbId, winnerId]);

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) {
      router.replace("/login");
      return;
    }
    let u: User;
    try {
      u = JSON.parse(cached);
      setUser(u);
    } catch {
      router.replace("/login");
      return;
    }
    loadWinner();
    fetch(`/api/users/${u.id}/profile`).then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.profile?.avatarUrl) setUserAvatarUrl(d.profile.avatarUrl);
    }).catch(() => {});
  }, [router, loadWinner]);

  // GIPHY browser: load trending when opened, debounced search
  useEffect(() => {
    if (!showGiphyBrowser) return;

    if (!giphySearchQuery.trim()) {
      setGiphyLoading(true);
      fetch("/api/giphy/trending")
        .then((r) => r.json())
        .then((body) => {
          setGiphyResults(body.data || []);
          setNoGiphyKey(!!body.noKey);
        })
        .catch(() => setGiphyResults([]))
        .finally(() => setGiphyLoading(false));
      return;
    }

    if (giphySearchTimeoutRef.current) clearTimeout(giphySearchTimeoutRef.current);
    giphySearchTimeoutRef.current = setTimeout(() => {
      setGiphyLoading(true);
      fetch(`/api/giphy/search?q=${encodeURIComponent(giphySearchQuery)}`)
        .then((r) => r.json())
        .then((body) => {
          setGiphyResults(body.data || []);
          setNoGiphyKey(!!body.noKey);
        })
        .catch(() => setGiphyResults([]))
        .finally(() => setGiphyLoading(false));
    }, 300);

    return () => {
      if (giphySearchTimeoutRef.current) clearTimeout(giphySearchTimeoutRef.current);
    };
  }, [showGiphyBrowser, giphySearchQuery]);

  async function submitRating() {
    if (!user || myThumb === null || myStars === 0) return;

    try {
      const res = await fetch(`/api/winners/${winnerId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          thumbsUp: myThumb,
          stars: myStars,
        }),
      });
      setRatingSubmitted(true);
      loadWinner();
      // Only animate/play sound for first rating (201); edits (200) don't add credits
      const delta = res.status === 201 ? 2 : undefined;
      window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
    } catch {
      console.error("Failed to submit rating");
    }
  }

  async function postComment() {
    const hasMedia = mediaFile || mediaPreview;
    if (!user || (!commentText.trim() && !hasMedia)) return;
    setPosting(true);

    try {
      let mediaUrl = "";
      let mediaType = "";

      if (mediaIsGiphy && mediaPreview) {
        mediaUrl = mediaPreview;
        mediaType = "gif";
      } else if (mediaFile) {
        const formData = new FormData();
        formData.append("file", mediaFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          mediaUrl = uploadData.url;
          mediaType = uploadData.mediaType;
        }
      } else if (mediaPreview) {
        // Already-uploaded image URL (from image picker modal)
        mediaUrl = mediaPreview;
        mediaType = "image";
      }

      await fetch(`/api/winners/${winnerId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          text: commentText.trim(),
          mediaUrl,
          mediaType,
          ...(replyingTo && { parentId: replyingTo.commentId }),
        }),
      });

      setCommentText("");
      setMediaFile(null);
      setMediaPreview("");
      setMediaIsGiphy(false);
      setShowGiphyBrowser(false);
      setGiphyPasteUrl("");
      setReplyingTo(null);
      loadWinner();
      window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: 5 } }));
    } catch {
      console.error("Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!user) return;
    try {
      await fetch(
        `/api/winners/${winnerId}/comments?commentId=${commentId}&userId=${user.id}`,
        { method: "DELETE" }
      );
      loadWinner();
    } catch {
      console.error("Failed to delete comment");
    }
  }

  async function toggleLike(commentId: string) {
    if (!user) return;
    setLikingId(commentId);
    try {
      await fetch(`/api/winners/${winnerId}/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      loadWinner();
      window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: 1 } }));
    } catch {
      console.error("Failed to toggle like");
    } finally {
      setLikingId(null);
    }
  }

  function insertGiphyFromPaste() {
    const embedUrl = getGiphyEmbedUrl(giphyPasteUrl);
    if (embedUrl) {
      setMediaPreview(embedUrl);
      setMediaIsGiphy(true);
      setMediaFile(null);
      setShowGiphyBrowser(false);
      setGiphyPasteUrl("");
    }
  }

  function selectGiphy(embedUrl: string) {
    setMediaPreview(embedUrl);
    setMediaIsGiphy(true);
    setMediaFile(null);
    setShowGiphyBrowser(false);
    setGiphySearchQuery("");
  }

  function removeMedia() {
    setMediaFile(null);
    setMediaPreview("");
    setMediaIsGiphy(false);
    setShowGiphyBrowser(false);
    setGiphyPasteUrl("");
    setGiphySearchQuery("");
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading || !winner || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const displayStars = hoverStars || myStars;

  return (
    <div className="min-h-screen">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      {/* Hero backdrop (backdrop art bleed, fallback to poster) */}
      {(winner.backdropUrl || winner.posterUrl) && (
        <div className="fixed inset-0 pointer-events-none">
          <img
            src={winner.backdropUrl || winner.posterUrl}
            alt=""
            className="w-full h-[60vh] object-cover opacity-[0.07]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--background)]/80 to-[var(--background)]" />
        </div>
      )}

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        {/* ─── Movie Hero ─── */}
        <div className="flex flex-col sm:flex-row gap-8 mb-10">
          {/* Poster */}
          <div className="flex-shrink-0 w-48 sm:w-56 mx-auto sm:mx-0">
            <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-purple-500/10 bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
              {winner.posterUrl ? (
                <img
                  src={winner.posterUrl}
                  alt={winner.movieTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="inline-flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" />
                </svg>
                <span className="text-xs uppercase tracking-widest text-amber-400/70 font-medium">
                  Weekly Winner
                </span>
              </div>
              {winner.weekTheme && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/15 border border-purple-500/25 text-purple-300">
                  {winner.weekTheme}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-white/95 mb-1">
              {winner.movieTitle}
            </h1>

            {winner.year && (
              <p className="text-white/40 text-sm mb-3">{winner.year}</p>
            )}

            {winner.submittedBy && (
              winner.submitterDisplayedBadge ? (
                winner.submittedByUserId ? (
                  <Link
                    href={`/profile/${winner.submittedByUserId}`}
                    className="flex items-center gap-4 p-5 rounded-2xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.09] hover:border-amber-500/30 transition-all duration-200 mb-6 group/card block"
                  >
                    <div className="shrink-0">
                      {winner.submitterAvatarUrl ? (
                        <img src={winner.submitterAvatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white/20 group-hover/card:border-amber-500/40 transition-colors" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-white/20 group-hover/card:border-amber-500/40 transition-colors">
                          {winner.submittedBy.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Picked this winner</p>
                      <p className="text-xl font-bold text-white/95 truncate">{winner.submittedBy}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-sm"
                          style={{
                            background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                            boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                          }}
                        >
                          Badge holder
                        </span>
                        <BadgePill movieTitle={winner.submitterDisplayedBadge.movieTitle} isHolo={winner.submitterDisplayedBadge.isHolo} />
                      </div>
                    </div>
                    <span className="text-white/20 group-hover/card:text-amber-400/50 transition-colors shrink-0" aria-hidden>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 p-5 rounded-2xl border border-white/15 bg-white/[0.06] mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-white/20" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Picked this winner</p>
                      <p className="text-xl font-bold text-white/95 truncate">{winner.submittedBy}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-sm"
                          style={{
                            background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                            boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                          }}
                        >
                          Badge holder
                        </span>
                        <BadgePill movieTitle={winner.submitterDisplayedBadge.movieTitle} isHolo={winner.submitterDisplayedBadge.isHolo} />
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-white/40 text-sm mb-4">
                  Picked by{" "}
                  {winner.submittedByUserId ? (
                    <Link href={`/profile/${winner.submittedByUserId}`} className="text-white/60 hover:text-purple-400 transition-colors">
                      {winner.submittedBy}
                    </Link>
                  ) : (
                    <span className="text-white/60">{winner.submittedBy}</span>
                  )}
                </p>
              )
            )}

            {winner.overview && (
              <p className="text-white/50 text-sm leading-relaxed mb-4 max-w-lg">
                {winner.overview}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {winner.tmdbId && (
                triviaCompleted ? (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Trivia completed
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      setShowTrivia(true);
                      setTriviaLoading(true);
                      setTriviaQuestions([]);
                      setTriviaIndex(0);
                      setTriviaAnswers([]);
                      setTriviaResult(null);
                      try {
                        const res = await fetch(`/api/trivia/${winnerId}?userId=${encodeURIComponent(user.id)}`);
                        const data = await res.json();
                        if (res.ok && data.questions?.length) {
                          setTriviaQuestions(data.questions);
                        } else {
                          setShowTrivia(false);
                          alert(data.error || "No trivia available");
                        }
                      } catch {
                        setShowTrivia(false);
                        alert("Failed to load trivia");
                      } finally {
                        setTriviaLoading(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm hover:bg-purple-500/20 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Play Trivia
                  </button>
                )
              )}
              {winner.letterboxdUrl && (
                <a
                  href={winner.letterboxdUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm hover:bg-green-500/20 transition-colors cursor-pointer"
                  onClick={(e) => { e.preventDefault(); window.open(winner.letterboxdUrl!, "_blank", "noopener,noreferrer"); }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  View on Letterboxd
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ─── Trailer Embed ─── */}
        {winner.trailerUrl && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Trailer</h3>
            </div>
            <div className="aspect-video">
              <iframe
                src={winner.trailerUrl}
                title={`${winner.movieTitle} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* ─── Runner-Ups ─── */}
        {winner.runnerUps && winner.runnerUps.length > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 mb-8">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
              Also in the Running
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {winner.runnerUps.map((ru, i) => (
                <div key={i} className="group relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]">
                  <div className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                    {ru.posterUrl ? (
                      <img src={ru.posterUrl} alt={ru.movieTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">{ru.movieTitle.charAt(0)}</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </div>
                  <div className="p-3 relative z-0">
                    <h4 className="text-sm font-semibold text-white/90 truncate">{ru.movieTitle}</h4>
                    <p className="text-[11px] text-white/30 mt-0.5 truncate">
                      {ru.year && <span className="text-white/40">{ru.year} &middot; </span>}
                      by{" "}
                      <Link href={`/profile/${ru.userId}`} className="text-white/40 hover:text-purple-400 transition-colors relative z-20">
                        {ru.userName}
                      </Link>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Rate This Movie ─── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-5">
            {ratingSubmitted ? "Your Rating" : "Rate This Movie"}
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Thumbs */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setMyThumb(true); setRatingSubmitted(false); }}
                className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl transition-all cursor-pointer ${
                  myThumb === true
                    ? "border-green-400 bg-green-500/15 shadow-lg shadow-green-500/20 scale-110"
                    : "border-white/10 bg-white/[0.02] hover:border-green-400/40 hover:bg-green-500/5"
                }`}
              >
                👍
              </button>
              <button
                onClick={() => { setMyThumb(false); setRatingSubmitted(false); }}
                className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl transition-all cursor-pointer ${
                  myThumb === false
                    ? "border-red-400 bg-red-500/15 shadow-lg shadow-red-500/20 scale-110"
                    : "border-white/10 bg-white/[0.02] hover:border-red-400/40 hover:bg-red-500/5"
                }`}
              >
                👎
              </button>
            </div>

            {/* Stars (half-star support) */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => {
                const filled = displayStars >= s;
                const halfFilled = !filled && displayStars >= s - 0.5;
                return (
                  <div key={s} className="relative w-8 h-8 cursor-pointer transition-transform hover:scale-110" onMouseLeave={() => setHoverStars(0)}>
                    {/* Left half — sets half star */}
                    <div
                      className="absolute inset-0 w-1/2 z-10"
                      onMouseEnter={() => setHoverStars(s - 0.5)}
                      onClick={() => { setMyStars(s - 0.5); setRatingSubmitted(false); }}
                    />
                    {/* Right half — sets full star */}
                    <div
                      className="absolute inset-0 left-1/2 w-1/2 z-10"
                      onMouseEnter={() => setHoverStars(s)}
                      onClick={() => { setMyStars(s); setRatingSubmitted(false); }}
                    />
                    {/* Full star (background) */}
                    <svg className="absolute inset-0 w-8 h-8 text-white/10" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                    </svg>
                    {/* Filled star */}
                    {filled && (
                      <svg className="absolute inset-0 w-8 h-8 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                      </svg>
                    )}
                    {/* Half-filled star */}
                    {halfFilled && (
                      <svg className="absolute inset-0 w-8 h-8 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" viewBox="0 0 24 24">
                        <defs><clipPath id={`half-${s}`}><rect x="0" y="0" width="12" height="24" /></clipPath></defs>
                        <path clipPath={`url(#half-${s})`} fill="currentColor" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                      </svg>
                    )}
                  </div>
                );
              })}
              {displayStars > 0 && (
                <span className="text-xs text-amber-400/60 ml-2 font-medium tabular-nums">{displayStars}/5</span>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={submitRating}
              disabled={myThumb === null || myStars === 0 || ratingSubmitted}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed ${
                ratingSubmitted
                  ? "bg-green-500/15 border border-green-500/30 text-green-400"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 disabled:opacity-30"
              }`}
            >
              {ratingSubmitted ? "Saved!" : "Submit Rating"}
            </button>
          </div>

          {/* Dabys Score — thumbs + stars combined (0–100), Fresh/Rotten */}
          <div className="mt-8 pt-6 border-t border-white/[0.06]">
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
              Dabys Score
            </h4>
            {winner.ratings.length === 0 ? (
              <p className="text-white/25 text-sm">
                No score yet — be the first to rate!
              </p>
            ) : (
              (() => {
                const pct = winner.stats?.dabysScorePct ?? 0;
                const isFresh = pct >= 60;
                return (
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-4xl font-bold tabular-nums ${
                          isFresh ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {pct}%
                      </span>
                      <span
                        className={`text-sm font-semibold uppercase tracking-wide ${
                          isFresh ? "text-green-400/80" : "text-red-400/80"
                        }`}
                      >
                        {isFresh ? "Fresh" : "Rotten"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-[140px] max-w-xs">
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
                        <div
                          className="h-full bg-green-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        <div
                          className="h-full bg-red-500 transition-all duration-500"
                          style={{ width: `${100 - pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-white/25 mt-1.5">
                        Thumbs + stars · Based on {winner.ratings.length} rating
                        {winner.ratings.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* ─── Codex set ─── */}
        {winner.tmdbId && winnerCollection && (
          <div
            className={`rounded-2xl border backdrop-blur-xl p-6 mb-8 ${
              winnerCollection.completed
                ? "border-2 border-amber-400/60 bg-gradient-to-b from-amber-500/15 to-amber-600/5 shadow-[0_0_20px_rgba(245,158,11,0.12)] ring-2 ring-amber-400/25"
                : "border-white/[0.08] bg-white/[0.03]"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <h3 className={`text-sm font-semibold uppercase tracking-widest ${winnerCollection.completed ? "text-amber-200" : "text-white/60"}`}>
                Codex set
              </h3>
              {winnerCollection.completed && (
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/90 text-amber-950 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  Complete
                </span>
              )}
            </div>
            {winnerCollection.poolEntries.length === 0 ? (
              <p className="text-sm text-white/40">No cards for this movie yet. Build the character pool to unlock.</p>
            ) : (
              <>
                <p className="text-sm text-white/50 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {winnerCollection.completed ? (
                    <span className="text-amber-400 font-medium">All {winnerCollection.poolEntries.length} discovered in Codex.</span>
                  ) : (
                    <>Discovered {winnerCollection.ownedCharacterIds.length} of {winnerCollection.poolEntries.length} in Codex</>
                  )}
                  {" · "}
                  <Link href="/cards" className="text-amber-400/80 hover:text-amber-400 transition-colors">
                    TCG → upload cards to Codex
                  </Link>
                  {" · "}
                  <button
                    type="button"
                    onClick={toggleTrack}
                    className={`text-sm font-medium transition-colors cursor-pointer ${isTracked ? "text-amber-400 hover:text-amber-300" : canTrack ? "text-white/50 hover:text-amber-400/90" : "text-white/30 cursor-not-allowed"}`}
                    disabled={!isTracked && !canTrack}
                    title={isTracked ? "Remove from pinned badge progress on TCG tab" : canTrack ? "Pin this movie in TCG tab to track badge progress" : "You can only track 3 movies at once"}
                  >
                    {isTracked ? "Untrack" : "Track"}
                  </button>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {(() => {
                    const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1 };
                    const sortedEntries = [...winnerCollection.poolEntries].sort(
                      (a, b) => (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0)
                    );
                    return sortedEntries.map((entry) => {
                      const discovered = winnerCollection.ownedCharacterIds.includes(entry.characterId);
                      if (!discovered) {
                        return (
                          <div
                            key={entry.characterId}
                            className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] flex items-center justify-center"
                            style={{ aspectRatio: "2 / 3.35" }}
                          >
                            <div className="flex flex-col items-center justify-center gap-2 text-white/25">
                              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span className="text-xs font-medium">?</span>
                            </div>
                          </div>
                        );
                      }
                      const codexCard = {
                        id: entry.characterId,
                        rarity: entry.rarity,
                        isFoil: false,
                        actorName: entry.actorName ?? "",
                        characterName: entry.characterName ?? "",
                        movieTitle: entry.movieTitle ?? "",
                        profilePath: entry.profilePath ?? "",
                        cardType: (entry as { cardType?: string }).cardType,
                      };
                      return (
                        <div key={entry.characterId} className="rounded-xl overflow-hidden ring-2 ring-transparent hover:ring-cyan-400/40 transition-shadow max-w-[140px] mx-auto w-full">
                          <CardDisplay card={codexCard} />
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Comments Section (tweet-style) ─── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
              Discussion ({winner.stats.totalComments})
            </h3>
          </div>

          {/* Compose */}
          <div className="px-6 py-5 border-b border-white/[0.06]">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-3 text-sm text-white/50">
                <span>Replying to <span className="text-purple-400/80">{replyingTo.userName}</span></span>
                <button type="button" onClick={() => setReplyingTo(null)} className="text-white/30 hover:text-white/60 cursor-pointer" aria-label="Cancel reply">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <div className="flex gap-3">
              {/* User avatar */}
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt={user.name} className="flex-shrink-0 w-10 h-10 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="What did you think?"
                  rows={2}
                  className="w-full bg-transparent border-none outline-none text-white/80 text-sm placeholder-white/20 resize-none"
                />

                {/* Media preview — uploaded image or GIPHY embed */}
                {mediaPreview && (
                  <div className="relative mt-2 inline-block">
                    {mediaIsGiphy ? (
                      <div className="relative rounded-xl overflow-hidden border border-white/[0.08] max-w-[280px]">
                        <iframe
                          src={mediaPreview}
                          title="GIPHY embed"
                          className="w-full h-[200px] pointer-events-none"
                        />
                        <button
                          onClick={removeMedia}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <img
                          src={mediaPreview}
                          alt="Upload preview"
                          className="max-h-48 rounded-xl border border-white/[0.08]"
                        />
                        <button
                          onClick={removeMedia}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Actions bar */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    {/* Image — opens picker modal (upload, URL, paste) */}
                    <button
                      onClick={() => setShowImagePicker(true)}
                      className="p-2 rounded-lg text-white/30 hover:text-purple-400 hover:bg-purple-500/10 transition-all cursor-pointer"
                      title="Add image"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    </button>
                    {/* GIPHY browser */}
                    <button
                      onClick={() => setShowGiphyBrowser(true)}
                      className="px-2.5 py-1.5 rounded-lg border border-white/10 text-white/30 hover:text-purple-400 hover:border-purple-500/30 text-xs font-bold transition-all cursor-pointer"
                    >
                      GIF
                    </button>
                  </div>

                  <button
                    onClick={postComment}
                    disabled={posting || (!commentText.trim() && !mediaFile && !mediaPreview)}
                    className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {posting ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comment feed */}
          {winner.comments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-white/25 text-sm">
                No comments yet. Be the first to share your thoughts!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {winner.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`px-6 py-5 hover:bg-white/[0.01] transition-colors ${comment.parentId ? "pl-14 border-l-2 border-white/[0.06] ml-4" : ""}`}
                >
                  <div className="flex gap-3">
                    {/* Commenter avatar */}
                    <Link href={`/profile/${comment.userId}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                      {comment.avatarUrl ? (
                        <img src={comment.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                          {comment.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0">
                      {/* Name + time + reply context */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {comment.parentUserName && (
                          <span className="text-xs text-white/30">Replying to <span className="text-purple-400/70">{comment.parentUserName}</span></span>
                        )}
                        <Link href={`/profile/${comment.userId}`} className="text-sm font-semibold text-white/80 hover:text-purple-400 transition-colors">
                          {comment.userName}
                        </Link>
                        {comment.displayedBadge && (
                          <BadgePill movieTitle={comment.displayedBadge.movieTitle} isHolo={comment.displayedBadge.isHolo} />
                        )}
                        <span className="text-xs text-white/20">
                          {timeAgo(comment.createdAt)}
                        </span>
                        {/* Delete own comment */}
                        {comment.userId === user.id && (
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="ml-auto text-white/15 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Comment text */}
                      {comment.text && (
                        <p className="text-sm text-white/70 mt-1 whitespace-pre-wrap break-words">
                          {comment.text}
                        </p>
                      )}

                      {/* Comment media — GIPHY embed or image */}
                      {comment.mediaUrl && (
                        <div className="mt-3">
                          {comment.mediaUrl.includes("giphy.com/embed") ? (
                            <div className="rounded-xl overflow-hidden border border-white/[0.06] max-w-[280px]">
                              <iframe
                                src={comment.mediaUrl}
                                title="GIPHY"
                                className="w-full h-[200px]"
                              />
                            </div>
                          ) : (
                            <img
                              src={comment.mediaUrl}
                              alt="Attached media"
                              className="max-w-full max-h-80 rounded-xl border border-white/[0.06]"
                            />
                          )}
                        </div>
                      )}

                      {/* Like + Reply actions */}
                      <div className="flex items-center gap-4 mt-2">
                        <button
                          onClick={() => toggleLike(comment.id)}
                          disabled={likingId === comment.id}
                          className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${comment.likedByMe ? "text-red-400" : "text-white/40 hover:text-red-400/80"}`}
                          title={comment.likedByMe ? "Unlike" : "Like"}
                        >
                          {comment.likedByMe ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                          )}
                          <span>{comment.likeCount ?? 0}</span>
                        </button>
                        <button
                          onClick={() => setReplyingTo({ commentId: comment.id, userName: comment.userName })}
                          className="text-xs font-medium text-white/40 hover:text-purple-400 transition-colors cursor-pointer"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Trivia modal ─── */}
        {showTrivia && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !triviaSubmitting && !triviaLoading && setShowTrivia(false)}
              aria-hidden
            />
            <div
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden"
              role="dialog"
              aria-label="Trivia"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {triviaLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mb-4" />
                    <p className="text-white/50 text-sm">Loading trivia...</p>
                  </div>
                ) : triviaResult ? (
                  <div>
                    <h3 className="text-xl font-bold text-white/90 mb-2">Results</h3>
                    <p className="text-white/70 mb-4">
                      You got {triviaResult.correctCount} out of {triviaResult.totalCount} correct!
                    </p>
                    <p className="text-amber-400 font-semibold mb-6">+{triviaResult.creditsEarned} credits</p>
                    <button
                      onClick={() => {
                        setShowTrivia(false);
                        const earned = triviaResult?.creditsEarned ?? 0;
                        setTriviaResult(null);
                        setTriviaCompleted(true);
                        window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: earned } }));
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-purple-500/30 bg-purple-500/10 backdrop-blur-md text-purple-200 font-medium hover:border-purple-500/50 hover:bg-purple-500/15 transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                ) : triviaQuestions.length > 0 ? (
                  (() => {
                    const q = triviaQuestions[triviaIndex];
                    const isLast = triviaIndex >= triviaQuestions.length - 1;
                    return (
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold text-white/90">Trivia</h3>
                          <span className="text-xs text-white/40">
                            {triviaIndex + 1} / {triviaQuestions.length}
                          </span>
                        </div>
                        <p className="text-white/90 mb-6">{q.question}</p>
                        <div className="flex flex-col gap-2">
                          {q.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                const next = [...triviaAnswers, { questionId: q.id, selectedIndex: i }];
                                setTriviaAnswers(next);
                                if (isLast) {
                                  setTriviaSubmitting(true);
                                  fetch(`/api/trivia/${winnerId}/submit`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ userId: user.id, answers: next }),
                                  })
                                    .then((r) => r.json())
                                    .then((data) => {
                                      if (data.creditsEarned != null) {
                                        setTriviaResult({
                                          correctCount: data.correctCount ?? 0,
                                          totalCount: data.totalCount ?? 0,
                                          creditsEarned: data.creditsEarned,
                                        });
                                      } else {
                                        alert(data.error || "Failed to submit");
                                      }
                                    })
                                    .catch(() => alert("Failed to submit"))
                                    .finally(() => setTriviaSubmitting(false));
                                } else {
                                  setTriviaIndex(triviaIndex + 1);
                                }
                              }}
                              disabled={triviaSubmitting}
                              className="w-full text-left px-4 py-3 rounded-xl bg-white/[0.06] backdrop-blur-md border border-white/[0.12] text-white/90 hover:bg-white/[0.1] hover:border-purple-500/30 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                ) : null}
              </div>
            </div>
          </>
        )}

        {/* ─── Expandable GIPHY browser modal (centered overlay) ─── */}
        {showGiphyBrowser && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              aria-hidden
              onClick={() => { setShowGiphyBrowser(false); setGiphySearchQuery(""); setGiphyPasteUrl(""); }}
            />
            <div
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-2xl border border-white/[0.08] bg-[var(--background)] shadow-2xl overflow-hidden"
              role="dialog"
              aria-label="Choose a GIF"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <button
                  onClick={() => { setShowGiphyBrowser(false); setGiphySearchQuery(""); setGiphyPasteUrl(""); }}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <span className="text-sm font-semibold text-white/80">GIPHY</span>
                <input
                  type="search"
                  value={giphySearchQuery}
                  onChange={(e) => setGiphySearchQuery(e.target.value)}
                  placeholder="Search GIFs..."
                  className="flex-1 min-w-0 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/30 outline-none focus:border-purple-500/40"
                  autoFocus
                />
              </div>

              {/* Content: paste fallback when no API key */}
              {noGiphyKey && (
                <div className="flex-1 overflow-auto p-4">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-white/50 text-sm mb-3">
                      Add <code className="text-purple-400/80">GIPHY_API_KEY</code> to your environment to browse GIFs. Or paste a link:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={giphyPasteUrl}
                        onChange={(e) => setGiphyPasteUrl(e.target.value)}
                        placeholder="https://giphy.com/gifs/..."
                        className="flex-1 min-w-0 bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/30 outline-none focus:border-purple-500/40"
                      />
                      <button
                        onClick={insertGiphyFromPaste}
                        disabled={!getGiphyEmbedUrl(giphyPasteUrl)}
                        className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-30 cursor-pointer shrink-0"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Content: grid when we have API */}
              {!noGiphyKey && (
                <div className="flex-1 overflow-auto p-4 min-h-0">
                  {giphyLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    </div>
                  ) : giphyResults.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-white/40 text-sm">
                        {giphySearchQuery.trim() ? "No GIFs found. Try another search." : "Loading..."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-white/30 mb-2">
                        {giphySearchQuery.trim() ? "Search results" : "Trending"}
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {giphyResults.map((gif) => (
                          <button
                            key={gif.id}
                            type="button"
                            onClick={() => selectGiphy(gif.embedUrl)}
                            className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500/50 focus:border-purple-500/50 focus:outline-none bg-white/[0.04] transition-all cursor-pointer group"
                          >
                            <img
                              src={gif.thumbnail}
                              alt={gif.title || "GIF"}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Image picker modal */}
      <ImageCropModal
        open={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onComplete={(url) => {
          setMediaPreview(url);
          setMediaFile(null);
          setMediaIsGiphy(false);
          setShowGiphyBrowser(false);
          setShowImagePicker(false);
        }}
        aspect={16 / 9}
        title="Add Image"
        skipCrop
      />
    </div>
  );
}
