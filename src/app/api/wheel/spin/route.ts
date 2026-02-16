import { NextResponse } from "next/server";
import { getWheel, saveWheel } from "@/lib/data";

const JERRY_USER_ID = "1"; // Only Jerry can spin

export async function POST(request: Request) {
  // Verify it's Jerry
  const body = await request.json().catch(() => ({}));
  if (body.userId !== JERRY_USER_ID) {
    return NextResponse.json(
      { error: "Only Jerry can spin the wheel" },
      { status: 403 }
    );
  }

  const wheel = getWheel();

  // Remove the previously confirmed theme from entries when starting a new spin
  if (wheel.lastConfirmedResult) {
    wheel.entries = wheel.entries.filter((e) => e !== wheel.lastConfirmedResult);
    wheel.lastResult = null;
    wheel.lastSpunAt = null;
    wheel.winnerIndex = null;
    wheel.lastConfirmedResult = null;
    wheel.lastConfirmedAt = null;
    saveWheel(wheel);
  }

  if (wheel.entries.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 entries to spin" },
      { status: 400 }
    );
  }

  // Don't allow spin while one is in progress
  if (wheel.spinning && wheel.spinStartedAt && wheel.duration) {
    const elapsed = Date.now() - new Date(wheel.spinStartedAt).getTime();
    if (elapsed < wheel.duration + 1000) {
      return NextResponse.json(
        { error: "A spin is already in progress" },
        { status: 409 }
      );
    }
  }

  // Pick a random winner and generate deterministic animation params
  const winnerIndex = Math.floor(Math.random() * wheel.entries.length);
  const winner = wheel.entries[winnerIndex];
  const fullSpins = 14 + Math.floor(Math.random() * 6); // 14-19 full spins for faster rate
  const duration = 10000; // 10s total — longer duration, higher spin rate

  wheel.spinning = true;
  wheel.spinStartedAt = new Date().toISOString();
  wheel.winnerIndex = winnerIndex;
  wheel.fullSpins = fullSpins;
  wheel.duration = duration;
  wheel.lastResult = winner;
  wheel.lastSpunAt = wheel.spinStartedAt;
  saveWheel(wheel);

  // Schedule clearing the spinning flag after animation completes
  setTimeout(() => {
    try {
      const w = getWheel();
      if (w.spinStartedAt === wheel.spinStartedAt) {
        w.spinning = false;
        saveWheel(w);
      }
    } catch { /* ignore */ }
  }, duration + 2000);

  return NextResponse.json({
    winnerIndex,
    winner,
    fullSpins,
    duration,
    spinStartedAt: wheel.spinStartedAt,
    wheel,
  });
}
