import { NextRequest, NextResponse } from 'next/server';
import { generateItineraryFromPlacesWithGemini, GenerateItineraryFromPlacesParams } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body: GenerateItineraryFromPlacesParams = await req.json();

    if (!body.destination) {
      return NextResponse.json(
        { error: 'Destination is required' },
        { status: 400 }
      );
    }

    const days = await generateItineraryFromPlacesWithGemini(body);

    return NextResponse.json({
      success: true,
      destination: body.destination,
      daysCount: days.length,
      days,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-itinerary:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate itinerary with Gemini' },
      { status: 500 }
    );
  }
}

