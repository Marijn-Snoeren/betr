import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function GET(request: Request) {
  // Optional secret verification to secure your cron
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `predictions:${today}`;

  try {
    // 1. Fetch live odds from The Odds API
    const oddsRes = await fetch(
      `https://api.the-odds-api.v4/sports/soccer/odds/?apiKey=${process.env.THE_ODDS_API_KEY}&regions=eu&markets=h2h`
    );
    const oddsData = await oddsRes.json();

    // 2. Format a single bulk prompt for Gemini to save tokens & API limits
    const prompt = `Analyze these upcoming football matches and odds: ${JSON.stringify(oddsData.slice(0, 5))}. 
    Return a strict JSON array where each item matches this structure:
    {
      "id": "unique-string",
      "league": "League Name",
      "day": "${today}",
      "time": "HH:MM",
      "home": { "name": "Team A", "logo": "https://placehold.co/100" },
      "away": { "name": "Team B", "logo": "https://placehold.co/100" },
      "pickOdds": 1.85,
      "prediction": {
        "homeWin": 50, "draw": 25, "awayWin": 25,
        "predictedScore": "2-1", "bestBet": "Home Win", "confidence": "High",
        "keyAbsences": "None", "tacticalEdge": "Strong home form"
      }
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const matches = JSON.parse(response.text || '[]');

    const payload = {
      date: today,
      matches,
      history: {},
    };

    // 3. Save to Vercel KV database
    await kv.set(cacheKey, payload);

    return NextResponse.json({ success: true, count: matches.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update odds cache' }, { status: 500 });
  }
}