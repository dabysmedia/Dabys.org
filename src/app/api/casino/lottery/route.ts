import { NextResponse } from "next/server";
import {
  getCurrentDrawId,
  getNextDrawAt,
  getLotteryTicketsForDraw,
  addLotteryTicket,
  runLotteryDraw,
  getLotteryDraw,
  getLatestLotteryDraw,
  getLotterySettings,
  deductCredits,
  getCredits,
  getScratchOffTicketsToday,
  getScratchOffDailyLimit,
} from "@/lib/data";

const LOTTERY_POOL_CAP = 600;

/** GET: lottery state. Runs draw lazily if past draw time. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? undefined;

  const now = Date.now();
  const nextDrawAt = getNextDrawAt().getTime();
  const currentDrawId = getCurrentDrawId();

  // If we're past draw time, run the draw for the previous period
  const prevDrawId = getPreviousDrawId();
  if (prevDrawId && !getLotteryDraw(prevDrawId)) {
    runLotteryDraw(prevDrawId);
  }

  const { ticketCost, startingPool, scratchOff } = getLotterySettings();
  const tickets = getLotteryTicketsForDraw(currentDrawId);
  const myTickets = userId ? tickets.filter((t) => t.userId === userId) : [];
  const latestDraw = getLatestLotteryDraw();
  const prizePool = tickets.length * ticketCost + startingPool;
  const soldOut = prizePool >= LOTTERY_POOL_CAP;
  const scratchOffTicketsToday = userId ? getScratchOffTicketsToday(userId) : 0;
  const scratchOffLimit = getScratchOffDailyLimit();
  const scratchOffSoldOut = scratchOffTicketsToday >= scratchOffLimit;

  return NextResponse.json({
    currentDrawId,
    nextDrawAt: getNextDrawAt().toISOString(),
    ticketPrice: ticketCost,
    totalTickets: tickets.length,
    myTickets: myTickets.length,
    prizePool,
    soldOut,
    scratchOffCost: scratchOff.cost,
    scratchOffDailyLimit: scratchOffLimit,
    scratchOffTicketsToday,
    scratchOffSoldOut,
    latestDraw: latestDraw
      ? {
          drawId: latestDraw.drawId,
          winnerUserId: latestDraw.winnerUserId,
          winnerUserName: latestDraw.winnerUserName,
          prizePool: latestDraw.prizePool,
          ticketCount: latestDraw.ticketCount,
          drawnAt: latestDraw.drawnAt,
        }
      : null,
  });
}

function getPreviousDrawId(): string | null {
  const next = getNextDrawAt();
  const prev = new Date(next);
  prev.setUTCDate(prev.getUTCDate() - 7);
  return prev.toISOString().slice(0, 10);
}

/** POST: purchase ticket(s). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const userName = body.userName as string | undefined;
  const count = typeof body.count === "number" ? Math.floor(body.count) : 1;

  if (!userId || !userName) {
    return NextResponse.json(
      { error: "userId and userName required" },
      { status: 400 }
    );
  }

  if (count < 1 || count > 10) {
    return NextResponse.json(
      { error: "Count must be between 1 and 10" },
      { status: 400 }
    );
  }

  const { ticketCost, startingPool } = getLotterySettings();
  const drawId = getCurrentDrawId();
  const tickets = getLotteryTicketsForDraw(drawId);
  const prizePool = tickets.length * ticketCost + startingPool;
  if (prizePool >= LOTTERY_POOL_CAP) {
    return NextResponse.json(
      { error: "Lottery sold out" },
      { status: 400 }
    );
  }

  const totalCost = count * ticketCost;
  const balance = getCredits(userId);
  if (balance < totalCost) {
    return NextResponse.json(
      { error: "Not enough credits" },
      { status: 400 }
    );
  }

  const deducted = deductCredits(userId, totalCost, "lottery_ticket", {
    count,
    drawId,
  });
  if (!deducted) {
    return NextResponse.json(
      { error: "Failed to deduct credits" },
      { status: 400 }
    );
  }

  const purchased: { id: string }[] = [];
  for (let i = 0; i < count; i++) {
    const ticket = addLotteryTicket(drawId, userId, userName);
    purchased.push({ id: ticket.id });
  }

  const ticketsAfter = getLotteryTicketsForDraw(drawId);
  const myTickets = ticketsAfter.filter((t) => t.userId === userId);
  const prizePoolAfter = ticketsAfter.length * ticketCost + startingPool;

  return NextResponse.json({
    success: true,
    purchased: purchased.length,
    totalCost,
    newBalance: getCredits(userId),
    myTickets: myTickets.length,
    prizePool: prizePoolAfter,
    drawId,
    nextDrawAt: getNextDrawAt().toISOString(),
  });
}
