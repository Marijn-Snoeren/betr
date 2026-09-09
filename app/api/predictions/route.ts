import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `predictions:${today}`;

  try {
    const data: any = await kv.get(cacheKey);

    if (!data) {
      // Fallback empty state if cron hasn't run yet today
      return NextResponse.json({ matches: [], history: {} });
    }

    if (type === 'history') {
      return NextResponse.json({ history: data.history || {} });
    }

    return NextResponse.json({ matches: data.matches || [] });
  } catch (error) {
    return NextResponse.json({ matches: [], history: {} });
  }
}