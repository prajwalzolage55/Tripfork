import { NextRequest, NextResponse } from 'next/server';
import { executeGeminiPrompt } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { message, destination, tripName, currentActivities = [], travelStyle = 'Balanced' } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const currentList = currentActivities.slice(0, 15).join(', ') || 'No activities added yet';

    const systemPrompt = `You are an expert AI Travel Assistant helping a traveler with their trip "${tripName || 'Vacation'}" to "${destination || 'their destination'}".
Travel style: ${travelStyle}.
Current scheduled activities: ${currentList}.

The user says: "${message}".

Provide a helpful, friendly, and concise response (max 2-3 short paragraphs).
If the user asks for recommendations, places to visit, restaurants, or changes, suggest a specific recommendation that they can add as an action item.

Return a JSON object in this exact shape:
{
  "text": "Your helpful conversational response to the user in markdown formatting.",
  "actionCard": {
    "type": "add_item",
    "title": "Exact Name of Suggested Place",
    "subtitle": "Short reason or best time to visit",
    "item": {
      "label": "Exact Name of Suggested Place",
      "type": "activity" | "dining" | "hotel" | "transfer",
      "cost": 500,
      "description": "Short description of what to do here",
      "locationName": "Location name",
      "latitude": 15.49,
      "longitude": 73.82
    }
  }
}
If no specific place is being suggested, omit the actionCard or set it to null.`;

    const result = await executeGeminiPrompt<any>(systemPrompt, 15000);

    return NextResponse.json({
      success: true,
      text: result?.text || 'Here is what I recommend for your itinerary!',
      actionCard: result?.actionCard || null,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/assistant:', error);
    return NextResponse.json(
      { 
        success: false, 
        text: "I couldn't reach the AI travel service at the moment. Please try asking again in a few seconds!",
        actionCard: null 
      },
      { status: 200 } // Return 200 with fallback text so chat UI does not break
    );
  }
}

