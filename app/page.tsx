'use client';

import { useEffect, useState, useRef } from 'react';

interface Match {
  id: string;
  league: string;
  day: string;
  time: string;
  home: { name: string; logo: string };
  away: { name: string; logo: string };
  pickOdds: number;
  prediction: {
    homeWin: number;
    draw: number;
    awayWin: number;
    predictedScore: string;
    bestBet: string;
    confidence: string;
    keyAbsences: string;
    tacticalEdge: string;
  };
}

interface HistoryItem {
  id: string;
  league: string;
  home: { name: string; logo: string };
  away: { name: string; logo: string };
  bestBet: string;
  predictedScore: string;
  finalScore: string;
  status: 'WON' | 'LOST' | 'PENDING';
  odds?: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'picks' | 'history'>('picks');
  const [matches, setMatches] = useState<Match[]>([]);
  const [history, setHistory] = useState<Record<string, HistoryItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedHistoryDate, setExpandedHistoryDate] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  useEffect(() => {
    fetch('/api/predictions')
      .then((res) => res.json())
      .then((data) => {
        setMatches(data.matches || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/predictions?type=history')
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history || {});
      })
      .catch(() => {});
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const toggleHistoryExpand = (dateKey: string) => {
    setExpandedHistoryDate((prev) => (prev === dateKey ? null : dateKey));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = Math.abs(touchStartY.current - touchEndY.current);
    const minSwipeDistance = 60;

    if (Math.abs(diffX) > minSwipeDistance && Math.abs(diffX) > diffY * 1.5) {
      if (diffX > 0 && activeTab === 'picks') {
        setActiveTab('history');
      } else if (diffX < 0 && activeTab === 'history') {
        setActiveTab('picks');
      }
    }
  };

  const handleBellClick = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('Push not supported on this browser');
      setTimeout(() => setPushStatus(null), 4000);
      return;
    }

    if (Notification.permission === 'denied') {
      setPushStatus('Notifications blocked. Please enable them in browser settings.');
      setTimeout(() => setPushStatus(null), 6000);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        
        if (!publicVapidKey) {
          setPushStatus('Notifications active (VAPID missing)');
          setTimeout(() => setPushStatus(null), 4000);
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicVapidKey,
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });

        setPushStatus('Notifications Enabled 🔔');
        setTimeout(() => setPushStatus(null), 4000);
      } else {
        setPushStatus('Notification permission dismissed');
        setTimeout(() => setPushStatus(null), 4000);
      }
    } catch (err) {
      console.error('Push subscription error:', err);
      setPushStatus('Failed to enable push');
      setTimeout(() => setPushStatus(null), 4000);
    }
  };

  const STARTING_BANKROLL = 10.0;
  const DAILY_STAKE = 10.0;

  const todayCombinedOdds = matches.length > 0
    ? matches.reduce((acc, m) => acc * (m.pickOdds || 1.85), 1)
    : 1.0;
  const todayPotentialPayout = Number((DAILY_STAKE * todayCombinedOdds).toFixed(2));

  let netPnL = 0;
  let totalProfit = 0;

  const parlayDays = Object.entries(history).map(([dateKey, items]) => {
    const isCompleted = items.length > 0 && items.every((i) => i.status !== 'PENDING');
    const isWin = items.length > 0 && items.every((i) => i.status === 'WON');
    const isLost = items.some((i) => i.status === 'LOST');

    const combinedOdds = items.reduce((acc, curr) => acc * (curr.odds || 1.85), 1);
    const payout = isWin ? Number((DAILY_STAKE * combinedOdds).toFixed(2)) : 0;
    const profit = isWin ? payout - DAILY_STAKE : isLost ? -DAILY_STAKE : 0;

    if (isCompleted) {
      netPnL += profit;
      totalProfit += profit;
    }

    return {
      dateKey,
      items,
      isCompleted,
      isWin,
      isLost,
      payout,
      profit,
      combinedOdds: combinedOdds.toFixed(2),
    };
  });

  const currentBalance = Number((STARTING_BANKROLL + netPnL).toFixed(2));
  const isPositiveTotal = totalProfit >= 0;
  const totalDiff = Math.abs(totalProfit).toFixed(2);

  return (
    <div className="min-h-screen bg-[#030712] text-white flex justify-center font-[Figtree] antialiased selection:bg-blue-600 selection:text-white">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap');
        
        .font-brice {
          font-family: 'Brice', 'Impact', sans-serif;
          letter-spacing: -0.02em;
        }
        .font-figtree {
          font-family: 'Figtree', sans-serif;
        }
      `}</style>

      {/* Mobile Shell Frame with Continuous Background Gradient */}
      <div 
        className="w-full max-w-[390px] min-h-screen relative flex flex-col border-x border-blue-950/40 pb-28 shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #101c38 0%, #070b19 35%, #050710 100%)'
        }}
      >
        
        {/* Top Navbar */}
        <header className="px-5 pt-5 pb-3 flex items-center justify-between relative z-10 shrink-0">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-zinc-400 tracking-wider uppercase">Welcome</span>
            <h2 className="text-2xl font-brice font-bold text-white tracking-wide uppercase">Marijn</h2>
          </div>

          <div className="flex items-center">
            <button
              onClick={handleBellClick}
              className="relative w-10 h-10 rounded-full bg-[#121c33]/85 backdrop-blur-md border border-blue-900/40 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 shadow-sm"
              title="Toggle Notifications"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>
        </header>

        {/* Status Notification Banner */}
        {pushStatus && (
          <div className="mx-5 mt-2 bg-blue-600/90 backdrop-blur-md text-white text-[11px] font-medium py-2 px-3 rounded-xl text-center shadow-lg animate-fadeIn z-20 border border-blue-400/30 shrink-0">
            {pushStatus}
          </div>
        )}

        {/* SWIPABLE VIEW CONTAINER */}
        <div 
          className="flex-1 flex flex-col min-h-0 relative overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div 
            className="flex w-[200%] h-full transition-transform duration-300 ease-out"
            style={{ transform: activeTab === 'picks' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            
            {/* ===================== PANEL 1: PICKS ===================== */}
            <div className="w-1/2 h-full flex flex-col shrink-0 overflow-y-auto px-5 pb-4">
              
              <div className="text-center pt-3 pb-3 relative z-10 shrink-0">
                <span className="text-[11px] font-medium text-zinc-400 tracking-wider uppercase">
                  Total Bankroll
                </span>
                <h1 className="text-[38px] font-bold text-white tracking-tight leading-none mt-1 font-brice">
                  € {currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',')}
                </h1>
                <div className="mt-1.5 text-xs font-medium text-zinc-400">
                  {isPositiveTotal ? '+' : '-'} €{totalDiff.replace('.', ',')}
                </div>
              </div>

              <div className="relative w-full h-14 -mt-2 mb-2 pointer-events-none opacity-40 z-10 shrink-0">
                <svg viewBox="0 0 400 60" className="w-full h-full preserve-3d" fill="none">
                  <path 
                    d="M0 45 Q 60 40, 120 30 T 240 25 T 320 15 T 400 5" 
                    stroke="url(#blueGrad)" 
                    strokeWidth="2.5" 
                  />
                  <defs>
                    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                      <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="pb-4 relative z-10 shrink-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#101726]/80 backdrop-blur-xl border border-blue-900/30 rounded-2xl p-3.5 flex flex-col justify-between shadow-lg">
                    <span className="text-[11px] text-zinc-400 font-normal">Combined Odds</span>
                    <span className="text-[20px] font-bold text-white tracking-tight mt-1 font-brice">
                      {todayCombinedOdds.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-[#101726]/80 backdrop-blur-xl border border-blue-900/30 rounded-2xl p-3.5 flex flex-col justify-between shadow-lg">
                    <span className="text-[11px] text-zinc-400 font-normal">Possible Return</span>
                    <span className="text-[20px] font-bold text-[#34d399] tracking-tight mt-1 font-brice">
                      €{todayPotentialPayout.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pb-2.5 pt-2 flex items-center justify-between relative z-10 shrink-0">
                <span className="text-[14px] font-semibold text-white tracking-tight">Today's Picks</span>
                <span className="text-xs font-medium text-blue-400">{matches.length} Matches</span>
              </div>

              <div className="space-y-2.5 flex-1">
                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Loading Slate...</span>
                  </div>
                ) : matches.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 text-xs font-medium">
                    No active fixtures found today
                  </div>
                ) : (
                  matches.map((m) => {
                    const isExpanded = expandedId === m.id;

                    return (
                      <div
                        key={m.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(m.id);
                        }}
                        className="bg-[#101726]/60 hover:bg-[#131d31]/80 backdrop-blur-md border border-blue-950/50 rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99] shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-950/40 border border-blue-800/30 p-1.5 flex items-center justify-center shrink-0">
                              <img src={m.home.logo} alt="" className="w-full h-full object-contain" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-[13px] font-semibold text-white truncate tracking-tight">
                                {m.home.name} vs {m.away.name}
                              </h4>
                              <span className="text-[11px] text-zinc-400 font-medium block leading-tight mt-0.5">
                                {m.time} • {m.league}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0 pl-3">
                            <span className="text-[13px] font-semibold text-white tracking-tight">
                              {m.prediction.bestBet}
                            </span>
                            <span className="text-[12px] font-brice font-bold text-blue-400 tracking-tight mt-0.5">
                              {m.pickOdds ? m.pickOdds.toFixed(2) : '1.85'}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-blue-950/60 space-y-2 text-xs">
                            <div className="flex justify-between items-center text-zinc-400 text-[11px]">
                              <span>Projected: <strong className="text-white font-medium">{m.prediction.predictedScore}</strong></span>
                              <span>Confidence: <strong className="text-blue-400 font-medium">{m.prediction.confidence}</strong></span>
                            </div>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {m.prediction.tacticalEdge}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* ===================== PANEL 2: HISTORY ===================== */}
            <div className="w-1/2 h-full flex flex-col shrink-0 overflow-y-auto px-5 pb-4">
              
              <div className="pb-2.5 pt-2 flex items-center justify-between relative z-10 shrink-0">
                <span className="text-[14px] font-semibold text-white tracking-tight">Slip History</span>
                <span className="text-xs font-medium text-blue-400">{parlayDays.length} Days</span>
              </div>

              <div className="space-y-2.5 flex-1">
                {parlayDays.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 text-xs font-medium">
                    No history recorded yet
                  </div>
                ) : (
                  parlayDays
                    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
                    .map((day) => {
                      const isPending = !day.isCompleted;
                      const isHistoryExpanded = expandedHistoryDate === day.dateKey;

                      return (
                        <div
                          key={day.dateKey}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHistoryExpand(day.dateKey);
                          }}
                          className="bg-[#101726]/60 hover:bg-[#131d31]/80 backdrop-blur-md border border-blue-950/50 rounded-2xl p-4 cursor-pointer transition-all shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-800/30 flex items-center justify-center text-xs font-brice font-bold text-blue-400">
                                📅
                              </div>
                              <div>
                                <span className="text-[13px] font-semibold text-white block">
                                  {day.dateKey}
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                  {day.items.length} legs • {day.combinedOdds}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {isPending ? (
                                <span className="text-[11px] font-medium text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded-full">
                                  Pending
                                </span>
                              ) : day.isWin ? (
                                <span className="text-[12px] font-brice font-bold text-[#34d399] bg-[#10b981]/10 border border-[#10b981]/30 px-2.5 py-1 rounded-lg">
                                  +€{day.profit.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-[12px] font-brice font-bold text-[#f87171] bg-[#ef4444]/10 border border-[#ef4444]/30 px-2.5 py-1 rounded-lg">
                                  -€10.00
                                </span>
                              )}

                              <svg 
                                className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isHistoryExpanded ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>

                          {/* Expanded Slip Breakdown */}
                          {isHistoryExpanded && (
                            <div className="mt-3.5 pt-3 border-t border-blue-950/60 space-y-2 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                              <div className="text-[10px] uppercase text-zinc-400 tracking-wider mb-1">
                                Slip Legs Breakdown
                              </div>
                              {day.items.map((leg) => (
                                <div
                                  key={leg.id}
                                  className="bg-[#050710]/80 border border-blue-950/40 rounded-xl p-2.5 flex items-center justify-between text-xs"
                                >
                                  <div className="min-w-0 pr-2">
                                    <span className="text-white font-medium truncate block">
                                      {leg.home.name} vs {leg.away.name}
                                    </span>
                                    <span className="text-[11px] text-zinc-400">
                                      Pick: <strong className="text-blue-300">{leg.bestBet}</strong> {leg.finalScore !== 'Pending' && `• Score: ${leg.finalScore}`}
                                    </span>
                                  </div>

                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                      leg.status === 'WON'
                                        ? 'text-[#34d399] bg-[#10b981]/15 border border-[#10b981]/30'
                                        : leg.status === 'LOST'
                                        ? 'text-[#f87171] bg-[#ef4444]/15 border border-[#ef4444]/30'
                                        : 'text-blue-300 bg-blue-950/60'
                                    }`}
                                  >
                                    {leg.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Bottom Floating Action Bar */}
        <div className="fixed bottom-4 max-w-[390px] w-full px-5 z-40">
          <nav className="bg-[#0f172a]/95 backdrop-blur-2xl border border-blue-900/40 p-2 rounded-full shadow-2xl flex items-center justify-between relative">
            
            <div 
              className={`absolute top-2 bottom-2 w-[calc(50%-6px)] rounded-full bg-blue-600 shadow-lg transition-transform duration-300 ease-out ${
                activeTab === 'history' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
              }`} 
            />

            <button
              onClick={() => setActiveTab('picks')}
              className={`relative z-10 flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold transition-colors ${
                activeTab === 'picks' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Picks</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`relative z-10 flex-1 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold transition-colors ${
                activeTab === 'history' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>History</span>
            </button>

          </nav>
        </div>

      </div>
    </div>
  );
}