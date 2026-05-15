import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ type: 'FeatureCollection', features: [] });
}
