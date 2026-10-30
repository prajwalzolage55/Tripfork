import { NextRequest, NextResponse } from 'next/server';
import { suggestPlacesWithGemini, PlaceSuggestionParams } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body: PlaceSuggestionParams = await req.json();

    if (!body.destination || !body.destination.trim()) {
      return NextResponse.json(
        { error: 'Destination is required' },
        { status: 400 }
      );
    }

    const places = await suggestPlacesWithGemini(body);

    return NextResponse.json({
      success: true,
      destination: body.destination,
      count: places.length,
      places,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/suggest-places:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to suggest places with Gemini' },
      { status: 500 }
    );
  }
}

