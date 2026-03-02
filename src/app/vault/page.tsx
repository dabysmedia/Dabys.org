"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type VaultTab = "dabys" | "hivemind";

interface VaultVideo {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnailUrl?: string;
  order: number;
  featured: boolean;
}

interface HivemindVideo {
  id: string;
  youtubeId: string;
  title?: string;
  addedByUserId?: string;
  addedByUserName?: string;
  addedAt: string;
  thumbsUp?: number;
  thumbsDown?: number;
  userVote?: 1 | -1;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: { videoId: string; events?: { onStateChange?: (e: { data: number }) => void } }
      ) => { destroy: () => void };
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function VaultVideoCard({
  video,
  userId,
  alreadyClaimed,
  creditsPerWatch,
  minWatchSeconds,
  onClaimed,
}: {
  video: VaultVideo;
  userId: string;
  alreadyClaimed: boolean;
  creditsPerWatch: number;
  minWatchSeconds: number;
  onClaimed: () => void;
}) {
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerRef = useRef<InstanceType<NonNullable<typeof window.YT>["Player"]> | null>(null);
  const containerId = `yt-player-${video.id}`;

  const canClaim = !alreadyClaimed && watchSeconds >= minWatchSeconds;

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      setApiReady(true);
    };
  }, []);

  // Create player and handle state changes (player always created so video can be re-watched; credits only on first claim)
  useEffect(() => {
    if (!apiReady || !video.youtubeId) return;
    const YT = window.YT;
    if (!YT?.Player) return;

    const el = document.getElementById(containerId);
    if (!el) return;

    const player = new YT.Player(containerId, {
      videoId: video.youtubeId,
      events: {
        onStateChange(e: { data: number }) {
          const PLAYING = 1;
          const PAUSED = 2;
          const ENDED = 0;
          if (e.data === ENDED) {
            setIsPlaying(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          } else if (e.data === PLAYING) {
            setIsPlaying(true);
            setHasStarted(true);
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                setWatchSeconds((s) => s + 1);
              }, 1000);
            }
          } else if (e.data === PAUSED) {
            setIsPlaying(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        },
      },
    });
    playerRef.current = player as unknown as InstanceType<NonNullable<typeof window.YT>["Player"]>;

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [apiReady, video.youtubeId, video.id]);

  async function handleClaim() {
    if (!canClaim || claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/vault/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, videoId: video.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onClaimed();
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: data.creditsAwarded } }));
      } else {
        setClaimError(data.message || "Could not claim credits");
      }
    } catch {
      setClaimError("Something went wrong");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.06)] hover:border-white/[0.18] hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-300">
      <div className="aspect-video bg-black relative overflow-hidden">
        <div id={containerId} className="w-full h-full" />
        {video.featured && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-400/50 text-amber-300 text-xs font-semibold uppercase tracking-wider shadow-lg">
            Featured
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-white/95 font-card-title">{video.title}</h3>
        {video.description && (
          <p className="text-white/50 text-sm mt-1">{video.description}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {alreadyClaimed ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Credits claimed
            </span>
          ) : (
            <>
              {watchSeconds < minWatchSeconds ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-white/40 text-sm">
                    {isPlaying ? (
                      <>Watching: {watchSeconds}s / {minWatchSeconds}s</>
                    ) : hasStarted ? (
                      <>Paused — timer stopped. Play to continue.</>
                    ) : (
                      <>Press play to start. Timer only runs while playing (no pause or skip).</>
                    )}
                  </span>
                  <span className="text-white/30 text-xs">
                    {minWatchSeconds - watchSeconds}s more to unlock claim
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/25 border-2 border-emerald-400/50 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/35 hover:border-emerald-400/60 shadow-[0_4px_16px_rgba(34,197,94,0.15)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {claiming ? (
                    <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  Claim {creditsPerWatch} credits
                </button>
              )}
            </>
          )}
          {claimError && (
            <span className="text-red-400/80 text-sm">{claimError}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const YOUTUBE_API_READY_EVENT = "dabys-youtube-api-ready";
const YT_PLAYING = 1;

function HivemindTheaterPlayer({
  video,
  onMinimize,
}: {
  video: HivemindVideo;
  onMinimize: () => void;
}) {
  const containerId = `yt-theater-${video.id}`;
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }
    const onReady = () => setApiReady(true);
    window.addEventListener(YOUTUBE_API_READY_EVENT, onReady);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      window.dispatchEvent(new CustomEvent(YOUTUBE_API_READY_EVENT));
    };
    return () => window.removeEventListener(YOUTUBE_API_READY_EVENT, onReady);
  }, []);

  useEffect(() => {
    if (!apiReady || !video.youtubeId) return;
    const YT = window.YT;
    if (!YT?.Player) return;
    const el = document.getElementById(containerId);
    if (!el) return;
    const player = new YT.Player(containerId, { videoId: video.youtubeId });
    return () => {
      (player as { destroy?: () => void }).destroy?.();
    };
  }, [apiReady, video.youtubeId, video.id]);

  return (
    <div className="w-full rounded-xl overflow-hidden border border-white/[0.15] bg-black/80 shadow-2xl">
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        <div id={containerId} className="absolute inset-0 w-full h-full" />
        <button
          onClick={onMinimize}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/90 text-sm font-medium border border-white/20 transition-colors"
        >
          Minimize
        </button>
      </div>
      {video.title && (
        <div className="px-4 py-2 bg-white/[0.03]">
          <p className="text-white/80 text-sm font-medium">{video.title}</p>
        </div>
      )}
    </div>
  );
}

function HivemindEmbedCard({
  video,
  currentUserId,
  theaterVideoId,
  onVoteUpdated,
  onPlaying,
  onMinimizeTheater,
}: {
  video: HivemindVideo;
  currentUserId: string;
  theaterVideoId: string | null;
  onVoteUpdated: (videoId: string, vote: 1 | -1) => void;
  onPlaying: (videoId: string) => void;
  onMinimizeTheater: () => void;
}) {
  const containerId = `yt-hivemind-${video.id}`;
  const [apiReady, setApiReady] = useState(false);
  const [voting, setVoting] = useState(false);
  const isInTheater = theaterVideoId === video.id;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }
    const onReady = () => setApiReady(true);
    window.addEventListener(YOUTUBE_API_READY_EVENT, onReady);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      window.dispatchEvent(new CustomEvent(YOUTUBE_API_READY_EVENT));
    };
    return () => window.removeEventListener(YOUTUBE_API_READY_EVENT, onReady);
  }, []);

  useEffect(() => {
    if (!apiReady || !video.youtubeId || isInTheater) return;
    const YT = window.YT;
    if (!YT?.Player) return;
    const el = document.getElementById(containerId);
    if (!el) return;
    const player = new YT.Player(containerId, {
      videoId: video.youtubeId,
      events: {
        onStateChange(e: { data: number }) {
          if (e.data === YT_PLAYING) onPlaying(video.id);
        },
      },
    });
    return () => {
      (player as { destroy?: () => void }).destroy?.();
    };
  }, [apiReady, video.youtubeId, video.id, isInTheater, onPlaying]);

  async function handleVote(vote: 1 | -1) {
    if (voting) return;
    setVoting(true);
    try {
      const res = await fetch("/api/vault/hivemind/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id, userId: currentUserId, vote }),
      });
      if (res.ok) onVoteUpdated(video.id, vote);
    } finally {
      setVoting(false);
    }
  }

  const thumbsUp = video.thumbsUp ?? 0;
  const thumbsDown = video.thumbsDown ?? 0;
  const userVote = video.userVote;

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.06)] hover:border-white/[0.18] hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all duration-300 flex flex-col">
      <div className="aspect-video bg-black relative overflow-hidden flex-shrink-0">
        {isInTheater ? (
          <div
            className="w-full h-full flex items-center justify-center bg-white/[0.05] cursor-pointer"
            onClick={onMinimizeTheater}
          >
            <div className="text-center">
              <p className="text-white/70 text-sm">Playing in theater above</p>
              <p className="text-white/40 text-xs mt-1">Click to minimize</p>
            </div>
          </div>
        ) : (
          <div id={containerId} className="w-full h-full" />
        )}
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        {video.title && (
          <h3 className="text-base font-semibold text-white/95 font-card-title leading-tight">
            {video.title}
          </h3>
        )}
        {video.addedByUserId && (
          <p className="text-sm text-white/55">
            Submitted by{" "}
            <Link
              href={`/profile/${video.addedByUserId}`}
              className="text-purple-300 hover:text-purple-200 font-medium transition-colors"
            >
              {video.addedByUserName ?? "Unknown"}
            </Link>
          </p>
        )}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleVote(1)}
            disabled={voting}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors disabled:opacity-50 ${
              userVote === 1
                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/40"
                : "bg-white/[0.06] text-white/60 hover:text-white/80 border border-white/[0.08]"
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 11V4l3-3h7v7H7z" />
            </svg>
            <span>{thumbsUp}</span>
          </button>
          <button
            onClick={() => handleVote(-1)}
            disabled={voting}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm transition-colors disabled:opacity-50 ${
              userVote === -1
                ? "bg-red-500/25 text-red-300 border border-red-400/40"
                : "bg-white/[0.06] text-white/60 hover:text-white/80 border border-white/[0.08]"
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13v7H7V6l3-3h7z" />
            </svg>
            <span>{thumbsDown}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VaultPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [vaultTab, setVaultTab] = useState<VaultTab>("dabys");
  const [videos, setVideos] = useState<VaultVideo[]>([]);
  const [hivemindVideos, setHivemindVideos] = useState<HivemindVideo[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [creditsPerWatch, setCreditsPerWatch] = useState(25);
  const [minWatchMinutes, setMinWatchMinutes] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hivemindLoading, setHivemindLoading] = useState(false);
  const [hivemindAddUrl, setHivemindAddUrl] = useState("");
  const [hivemindAdding, setHivemindAdding] = useState(false);
  const [hivemindError, setHivemindError] = useState<string | null>(null);
  const [theaterVideoId, setTheaterVideoId] = useState<string | null>(null);
  const [hivemindFilterUserId, setHivemindFilterUserId] = useState<string>("");

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(cached) as { id: string; name: string };
      setUser(u);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/vault")
      .then((r) => (r.ok ? r.json() : { videos: [], creditsPerWatch: 25 }))
      .then((data: { videos?: VaultVideo[]; creditsPerWatch?: number; vaultMinWatchMinutes?: number }) => {
        setVideos(Array.isArray(data.videos) ? data.videos : []);
        setCreditsPerWatch(typeof data.creditsPerWatch === "number" ? data.creditsPerWatch : 25);
        setMinWatchMinutes(typeof data.vaultMinWatchMinutes === "number" ? data.vaultMinWatchMinutes : 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (vaultTab !== "hivemind") {
      setTheaterVideoId(null);
      return;
    }
    if (!user) return;
    setHivemindLoading(true);
    fetch(`/api/vault/hivemind?userId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((data: { videos?: HivemindVideo[] }) => {
        setHivemindVideos(Array.isArray(data.videos) ? data.videos : []);
      })
      .catch(() => setHivemindVideos([]))
      .finally(() => setHivemindLoading(false));
  }, [user, vaultTab]);

  async function addHivemindVideo() {
    if (!hivemindAddUrl.trim() || !user || hivemindAdding) return;
    setHivemindAdding(true);
    setHivemindError(null);
    try {
      const res = await fetch("/api/vault/hivemind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeId: hivemindAddUrl.trim(), userId: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.video) {
        setHivemindVideos((prev) => [data.video, ...prev]);
        setHivemindAddUrl("");
      } else {
        setHivemindError(data.error || "Failed to add video");
      }
    } catch {
      setHivemindError("Something went wrong");
    } finally {
      setHivemindAdding(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    fetch(`/api/vault/claimed?userId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : { claimedVideoIds: [] }))
      .then((data) => setClaimedIds(new Set(data.claimedVideoIds || [])))
      .catch(() => {});
  }, [user]);

  const handleTheaterPlaying = useCallback((videoId: string) => setTheaterVideoId(videoId), []);
  const handleMinimizeTheater = useCallback(() => setTheaterVideoId(null), []);

  const handleVoteUpdated = useCallback((videoId: string, vote: 1 | -1) => {
    setHivemindVideos((prev) =>
      prev.map((x) => {
        if (x.id !== videoId) return x;
        const wasUp = x.userVote === 1;
        const wasDown = x.userVote === -1;
        let thumbsUp = x.thumbsUp ?? 0;
        let thumbsDown = x.thumbsDown ?? 0;
        if (wasUp && vote === -1) {
          thumbsUp--;
          thumbsDown++;
        } else if (wasDown && vote === 1) {
          thumbsDown--;
          thumbsUp++;
        } else if (!wasUp && !wasDown) {
          if (vote === 1) thumbsUp++;
          else thumbsDown++;
        }
        return { ...x, thumbsUp, thumbsDown, userVote: vote };
      })
    );
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const handleClaimed = (videoId: string) => {
    setClaimedIds((prev) => new Set(prev).add(videoId));
  };

  const featured = videos.filter((v) => v.featured);
  const other = videos.filter((v) => !v.featured);

  return (
    <div className="min-h-screen">
      {/* Ambient glow — premium vault feel (scrolling bg comes from layout) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] rounded-full bg-purple-600/12 blur-[180px] animate-[casino-glow-pulse_6s_ease-in-out_infinite]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full bg-indigo-600/10 blur-[160px] animate-[casino-glow-pulse_8s_ease-in-out_infinite]" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[140px] animate-[casino-glow-pulse_7s_ease-in-out_infinite]" style={{ animationDelay: "-1s" }} />
      </div>

      <main className="relative z-10 px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto mb-8">
          <h1
            className="text-3xl sm:text-4xl font-bold text-white/95 font-card-title tracking-tight"
            style={{ fontFamily: "'Libre Baskerville', serif" }}
          >
            The Vault
          </h1>
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => setVaultTab("dabys")}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                vaultTab === "dabys"
                  ? "bg-purple-500/25 border-2 border-purple-400/50 text-purple-200 shadow-[0_4px_20px_rgba(139,92,246,0.15)]"
                  : "border border-white/[0.15] bg-white/[0.04] text-white/60 hover:text-white/85 hover:bg-white/[0.08] hover:border-white/[0.2]"
              }`}
            >
              Dabys
            </button>
            <button
              onClick={() => setVaultTab("hivemind")}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                vaultTab === "hivemind"
                  ? "bg-purple-500/25 border-2 border-purple-400/50 text-purple-200 shadow-[0_4px_20px_rgba(139,92,246,0.15)]"
                  : "border border-white/[0.15] bg-white/[0.04] text-white/60 hover:text-white/85 hover:bg-white/[0.08] hover:border-white/[0.2]"
              }`}
            >
              Hivemind YouTube
            </button>
          </div>
          <p className="text-white/55 text-sm mt-4 tracking-wide">
            {vaultTab === "dabys"
              ? "Original Dabys Media content. Watch to earn credits — first watch per video only."
              : "Community-submitted YouTube videos. No credits — just watch and enjoy."}
          </p>
        </div>

        {vaultTab === "hivemind" ? (
          <div className="w-full max-w-6xl mx-auto space-y-6">
            {/* Add bar or theater (theater replaces add bar when active) */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center p-4 rounded-xl border border-white/[0.1] bg-white/[0.03]">
              {theaterVideoId ? (() => {
                const theaterVideo = hivemindVideos.find((v) => v.id === theaterVideoId);
                return theaterVideo ? (
                  <div className="w-full flex justify-center">
                    <div className="w-full">
                      <HivemindTheaterPlayer
                        video={theaterVideo}
                        onMinimize={handleMinimizeTheater}
                      />
                    </div>
                  </div>
                ) : null;
              })() : (
                <>
                  <div className="flex-1 flex gap-2 min-w-0">
                    <input
                      type="text"
                      value={hivemindAddUrl}
                      onChange={(e) => setHivemindAddUrl(e.target.value)}
                      placeholder="Paste YouTube URL or video ID..."
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/50 placeholder:text-white/35"
                    />
                    <button
                      onClick={addHivemindVideo}
                      disabled={!hivemindAddUrl.trim() || hivemindAdding}
                      className="px-5 py-2.5 rounded-lg bg-purple-500/25 border border-purple-400/50 text-purple-300 font-semibold text-sm hover:bg-purple-500/35 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {hivemindAdding ? "Adding..." : "Add video"}
                    </button>
                  </div>
                  {hivemindError && (
                    <p className="text-red-400/80 text-sm sm:order-last">{hivemindError}</p>
                  )}
                </>
              )}
            </div>

            {hivemindLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              </div>
            ) : hivemindVideos.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] backdrop-blur-xl p-20 text-center shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                <p className="text-white/55 mb-1">No Hivemind videos yet.</p>
                <p className="text-white/40 text-sm">Add a YouTube video above to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="hivemind-user-filter" className="text-sm text-white/50">
                    Filter by user:
                  </label>
                  <select
                    id="hivemind-user-filter"
                    value={hivemindFilterUserId}
                    onChange={(e) => setHivemindFilterUserId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white/90 text-sm outline-none focus:border-purple-500/50"
                  >
                    <option value="">All users</option>
                    {(() => {
                      const seen = new Set<string>();
                      return hivemindVideos
                        .filter((v) => {
                          if (!v.addedByUserId || seen.has(v.addedByUserId)) return false;
                          seen.add(v.addedByUserId);
                          return true;
                        })
                        .sort((a, b) => (a.addedByUserName ?? "").localeCompare(b.addedByUserName ?? ""))
                        .map((v) => (
                          <option key={v.addedByUserId} value={v.addedByUserId!}>
                            {v.addedByUserName ?? "Unknown"}
                          </option>
                        ));
                    })()}
                  </select>
                </div>
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {[...hivemindVideos]
                    .filter((v) => !hivemindFilterUserId || v.addedByUserId === hivemindFilterUserId)
                    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
                    .map((v) => (
                      <HivemindEmbedCard
                        key={v.id}
                        video={v}
                        currentUserId={user.id}
                        theaterVideoId={theaterVideoId}
                        onVoteUpdated={handleVoteUpdated}
                        onPlaying={handleTheaterPlaying}
                        onMinimizeTheater={handleMinimizeTheater}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="max-w-4xl mx-auto rounded-2xl border border-white/[0.12] bg-white/[0.04] backdrop-blur-xl p-16 text-center shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            <p className="text-white/55">No videos in the Vault yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {featured.length > 0 && (
              <section className="w-full max-w-[min(100%,1400px)] mx-auto">
                <h2 className="text-xs font-semibold text-white/50 uppercase tracking-[0.25em] mb-5">
                  Featured
                </h2>
                <div className="w-full">
                  {featured.map((v) => (
                    <VaultVideoCard
                      key={v.id}
                      video={v}
                      userId={user.id}
                      alreadyClaimed={claimedIds.has(v.id)}
                      creditsPerWatch={creditsPerWatch}
                      minWatchSeconds={minWatchMinutes * 60}
                      onClaimed={() => handleClaimed(v.id)}
                    />
                  ))}
                </div>
              </section>
            )}
            {other.length > 0 && (
              <section className="w-full max-w-[min(100%,1400px)] mx-auto">
                <h2 className="text-xs font-semibold text-white/50 uppercase tracking-[0.25em] mb-5">
                  More from Dabys Media
                </h2>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {other.map((v) => (
                    <VaultVideoCard
                      key={v.id}
                      video={v}
                      userId={user.id}
                      alreadyClaimed={claimedIds.has(v.id)}
                      creditsPerWatch={creditsPerWatch}
                      minWatchSeconds={minWatchMinutes * 60}
                      onClaimed={() => handleClaimed(v.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
