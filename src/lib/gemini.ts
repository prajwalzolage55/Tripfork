// Gemini API client and itinerary synthesis engine

export interface SuggestedPlace {
  id: string;
  name: string;
  category: 'activity' | 'dining' | 'hotel' | 'transfer' | 'other';
  description: string;
  recommendedDurationMinutes: number;
  bestTimeToVisit: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Anytime';
  estimatedCostINR: number;
  latitude: number;
  longitude: number;
  address?: string;
  highlights: string[];
  whyRecommended: string;
  accepted?: boolean;
}

export interface PlaceSuggestionParams {
  destination: string;
  travelStyle?: string;
  interests?: string[];
  budget?: number | null;
  travelers?: number;
  transport?: string[];
  food?: string;
  specialRequirements?: string;
  additionalPrompt?: string;
  count?: number;
}

export interface ItineraryItemPlan {
  id: string;
  label: string;
  type: 'activity' | 'dining' | 'hotel' | 'transfer' | 'other';
  startTime: string; // e.g. "09:30"
  endTime: string;   // e.g. "11:30"
  cost: number;
  description: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  estimatedTravelTime?: string;
  travelDistanceKm?: number;
}

export interface ItineraryDayPlan {
  dayIndex: number;
  title: string;
  date: string;
  items: ItineraryItemPlan[];
}

export interface GenerateItineraryFromPlacesParams {
  destination: string;
  startDate?: string | null;
  endDate?: string | null;
  acceptedPlaces: SuggestedPlace[];
  travelStyle?: string;
  travelers?: number;
  budget?: number | null;
}

// Recommended Gemini models in priority order based on latency & availability
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
];

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  return key.trim();
}

/**
 * Execute a Gemini prompt with structured JSON response and automatic model fallback
 */
export async function executeGeminiPrompt<T>(prompt: string, timeoutMs = 15000): Promise<T> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please check your .env.local file.');
  }

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini model ${model} responded with HTTP ${response.status}:`, errorText.slice(0, 180));
        // If 503 (high demand) or 404, try next model
        continue;
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error(`Empty response from Gemini model ${model}`);
      }

      const parsed = JSON.parse(rawText) as T;
      return parsed;
    } catch (err: any) {
      console.warn(`Gemini model ${model} failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed to generate content');
}

/**
 * Suggest top curated places in an area based on user preferences
 */
export async function suggestPlacesWithGemini(params: PlaceSuggestionParams): Promise<SuggestedPlace[]> {
  const destination = params.destination.trim() || 'Goa';
  const count = params.count || 10;
  const interests = params.interests?.length ? params.interests.join(', ') : 'Must-visit highlights, scenic spots, local food';
  const travelStyle = params.travelStyle || 'Balanced';
  const transport = params.transport?.length ? params.transport.join(', ') : 'Mixed';
  const budgetStr = params.budget ? `₹${params.budget}` : 'Flexible budget';
  const foodPref = params.food || 'Local cuisine, popular dining';
  const specialNotes = params.specialRequirements || 'None';
  const additionalPrompt = params.additionalPrompt ? `Special user request: "${params.additionalPrompt}". Please emphasize this.` : '';

  const prompt = `You are an elite travel concierge and destination guide.
Destination: "${destination}"
Travel Style: "${travelStyle}" (Pace: ${travelStyle === 'Relaxed' ? 'laid-back, few spots' : travelStyle === 'Packed' ? 'high energy, many spots' : 'balanced exploration'})
Interests: ${interests}
Budget: ${budgetStr} for ${params.travelers || 2} travelers
Preferred Transport: ${transport}
Food Preferences: ${foodPref}
Special Requirements / Constraints: ${specialNotes}
${additionalPrompt}

Suggest exactly ${count} diverse, top-rated places to visit in or immediately around ${destination}.
Include a rich variety:
- Iconic sights & architectural or natural landmarks
- Hidden gems or scenic viewpoints
- Highly-rated authentic dining / food experiences matching food preferences
- Activities or cultural experiences

For each place, provide accurate real-world latitude and longitude coordinates.

Return a JSON array of objects with this EXACT structure:
[
  {
    "id": "place_1",
    "name": "Full official name of the place",
    "category": "activity",
    "description": "Engaging 1-2 sentence description explaining what makes this place special.",
    "recommendedDurationMinutes": 90,
    "bestTimeToVisit": "Morning",
    "estimatedCostINR": 200,
    "latitude": 15.4920,
    "longitude": 73.7737,
    "address": "Area, City, State",
    "highlights": ["Key highlight 1", "Key highlight 2"],
    "whyRecommended": "Specific reason this fits their ${travelStyle} style and interest in ${interests}."
  }
]

Allowed categories: "activity" (for sights, attractions, experiences), "dining" (for restaurants, cafes, street food), "hotel" (for resorts, stays), "transfer" (for transit hubs), "other".
Allowed bestTimeToVisit: "Morning", "Afternoon", "Evening", "Night", "Anytime".`;

  try {
    const places = await executeGeminiPrompt<SuggestedPlace[]>(prompt, 18000);
    if (Array.isArray(places) && places.length > 0) {
      return places.map((p, idx) => ({
        ...p,
        id: p.id || `place_${idx + 1}_${Date.now()}`,
        category: (['activity', 'dining', 'hotel', 'transfer', 'other'].includes(p.category) ? p.category : 'activity') as any,
        estimatedCostINR: typeof p.estimatedCostINR === 'number' ? p.estimatedCostINR : 0,
        recommendedDurationMinutes: p.recommendedDurationMinutes || 90,
        accepted: true, // Default to accepted so user can easily keep or reject
      }));
    }
  } catch (err) {
    console.error('Failed to get Gemini places suggestions, creating dynamic fallback:', err);
  }

  // Fallback heuristic if API unavailable
  return getFallbackPlaces(destination, interests);
}

/**
 * Generate a coherent day-by-day itinerary schedule from accepted places
 */
export async function generateItineraryFromPlacesWithGemini(
  params: GenerateItineraryFromPlacesParams
): Promise<ItineraryDayPlan[]> {
  const { destination, startDate, endDate, acceptedPlaces, travelStyle = 'Balanced' } = params;

  // Calculate day count
  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  const end = endDate ? new Date(endDate + 'T00:00:00') : new Date(start.getTime() + 2 * 86400000);
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  const numDays = Math.min(14, Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1));

  if (!acceptedPlaces || acceptedPlaces.length === 0) {
    // Generate empty days
    return Array.from({ length: numDays }, (_, i) => {
      const d = new Date(start.getTime() + i * 86400000);
      return {
        dayIndex: i + 1,
        title: `Day ${i + 1}`,
        date: d.toISOString().split('T')[0],
        items: [],
      };
    });
  }

  const placesContext = acceptedPlaces.map((p, i) => 
    `[${i + 1}] "${p.name}" (${p.category}) - ${p.description} (Best time: ${p.bestTimeToVisit}, Duration: ${p.recommendedDurationMinutes}m, Lat: ${p.latitude}, Lng: ${p.longitude}, Cost: ₹${p.estimatedCostINR})`
  ).join('\n');

  const prompt = `You are a master itinerary scheduling engine.
Destination: "${destination}"
Total Trip Duration: ${numDays} days (${startDate || 'Start'} to ${endDate || 'End'})
Travel Style: "${travelStyle}"
The user has reviewed and ACCEPTED the following ${acceptedPlaces.length} places to include in their trip:

${placesContext}

TASK:
Organize ALL the accepted places into a logical, realistic ${numDays}-day itinerary.
1. Group geographically close places together on the same day to minimize driving time.
2. Schedule daily flow logically:
   - Morning activity / sightseeing (~09:00 - 12:30)
   - Lunch / dining break (~12:30 - 14:00)
   - Afternoon activity / cultural spot (~14:30 - 17:00)
   - Late afternoon / sunset spot (~17:00 - 19:00)
   - Dinner / evening experience (~19:30 - 21:30)
3. If there are fewer accepted places than needed for full days, you may supplement with appropriate meals or local relaxation spots.
4. Calculate realistic travel time and distance in km between consecutive stops.

Return a JSON array of objects representing the days:
[
  {
    "dayIndex": 1,
    "title": "Day 1: Coastal Explorations & Sunset",
    "date": "${startDate || new Date().toISOString().split('T')[0]}",
    "items": [
      {
        "id": "item_1_1",
        "label": "Place Name",
        "type": "activity",
        "startTime": "09:30",
        "endTime": "11:30",
        "cost": 100,
        "description": "What to do here",
        "locationName": "Place Name",
        "latitude": 15.492,
        "longitude": 73.773,
        "estimatedTravelTime": "20 minutes",
        "travelDistanceKm": 8.5
      }
    ]
  }
]`;

  try {
    const daysPlan = await executeGeminiPrompt<ItineraryDayPlan[]>(prompt, 20000);
    if (Array.isArray(daysPlan) && daysPlan.length > 0) {
      // Map proper dates to each day
      return daysPlan.map((day, idx) => {
        const curDate = new Date(start.getTime() + idx * 86400000);
        const dateStr = curDate.toISOString().split('T')[0];
        return {
          ...day,
          dayIndex: idx + 1,
          date: dateStr,
          items: Array.isArray(day.items) ? day.items.map(item => ({
            ...item,
            id: item.id || `item_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
            type: (['activity', 'dining', 'hotel', 'transfer', 'other'].includes(item.type) ? item.type : 'activity') as any,
          })) : [],
        };
      });
    }
  } catch (err) {
    console.error('Failed to generate full itinerary with Gemini, applying programmatic distribution:', err);
  }

  // Programmatic fallback: distribute accepted places across days
  return distributePlacesAcrossDays(start, numDays, acceptedPlaces);
}

/**
 * Fallback distributor when Gemini is offline
 */
function distributePlacesAcrossDays(start: Date, numDays: number, places: SuggestedPlace[]): ItineraryDayPlan[] {
  const days: ItineraryDayPlan[] = [];
  const placesPerDay = Math.ceil(places.length / numDays);

  for (let d = 0; d < numDays; d++) {
    const dayDate = new Date(start.getTime() + d * 86400000);
    const dateStr = dayDate.toISOString().split('T')[0];
    const dayPlaces = places.slice(d * placesPerDay, (d + 1) * placesPerDay);

    let startHour = 9;
    const items: ItineraryItemPlan[] = [];

    // Morning breakfast
    items.push({
      id: `fallback_bf_${d}`,
      label: 'Breakfast & Morning Coffee',
      type: 'dining',
      startTime: '08:30',
      endTime: '09:30',
      cost: 300,
      description: 'Local breakfast to kickstart the day',
      estimatedTravelTime: '10 minutes',
      travelDistanceKm: 2,
    });

    dayPlaces.forEach((p, pIdx) => {
      const durHours = Math.max(1, Math.round(p.recommendedDurationMinutes / 60));
      const endHour = startHour + durHours;
      const shStr = `${startHour.toString().padStart(2, '0')}:00`;
      const ehStr = `${endHour.toString().padStart(2, '0')}:00`;

      items.push({
        id: `fallback_item_${d}_${pIdx}`,
        label: p.name,
        type: p.category,
        startTime: shStr,
        endTime: ehStr,
        cost: p.estimatedCostINR,
        description: p.description,
        locationName: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        estimatedTravelTime: '20 minutes',
        travelDistanceKm: 7.5,
      });

      startHour = endHour + 1;
    });

    // Dinner
    items.push({
      id: `fallback_din_${d}`,
      label: 'Evening Dinner & Local Cuisine',
      type: 'dining',
      startTime: '19:30',
      endTime: '21:00',
      cost: 600,
      description: 'Relaxed dinner trying local specialties',
      estimatedTravelTime: '15 minutes',
      travelDistanceKm: 4,
    });

    days.push({
      dayIndex: d + 1,
      title: `Day ${d + 1}: ${dayPlaces[0]?.name ? dayPlaces[0].name + ' & Surrounds' : 'Local Discovery'}`,
      date: dateStr,
      items,
    });
  }

  return days;
}

/**
 * Dynamic fallback places for standard destinations
 */
function getFallbackPlaces(destination: string, interests: string): SuggestedPlace[] {
  const destLower = destination.toLowerCase();

  if (destLower.includes('alibag') || destLower.includes('alibaug')) {
    return [
      {
        id: 'fb-alibag-1',
        name: 'Kolaba Sea Fort',
        category: 'activity',
        description: 'Historic sea fortress reachable by foot during low tide with cannons and panoramic coastal views.',
        recommendedDurationMinutes: 120,
        bestTimeToVisit: 'Morning',
        estimatedCostINR: 100,
        latitude: 18.6300,
        longitude: 72.8600,
        highlights: ['Low tide walk', 'Ancient Portuguese cannons', 'Ocean views'],
        whyRecommended: 'Top historic highlight of Alibag surrounded by Arabian Sea waves.',
        accepted: true,
      },
      {
        id: 'fb-alibag-2',
        name: 'Varsoli White Sand Beach',
        category: 'activity',
        description: 'Quiet white-sand beach lined with casuarina trees, perfect for a relaxing coastal stroll.',
        recommendedDurationMinutes: 90,
        bestTimeToVisit: 'Afternoon',
        estimatedCostINR: 0,
        latitude: 18.6600,
        longitude: 72.8700,
        highlights: ['Quiet shoreline', 'Water sports', 'Seafood shacks'],
        whyRecommended: 'Less crowded beach ideal for relaxing and enjoying fresh sea breeze.',
        accepted: true,
      },
      {
        id: 'fb-alibag-3',
        name: 'Mandwa Bay & Watersports',
        category: 'activity',
        description: 'Bustling bay with jet skiing, banana rides, bumper boats, and vibrant waterfront cafes.',
        recommendedDurationMinutes: 150,
        bestTimeToVisit: 'Morning',
        estimatedCostINR: 1200,
        latitude: 18.7900,
        longitude: 72.8800,
        highlights: ['Jet skiing', 'Water sports', 'Ferry harbor'],
        whyRecommended: 'Ideal for adventure and high-energy watersport activities.',
        accepted: true,
      },
      {
        id: 'fb-alibag-4',
        name: 'Nagaon Beach & Sunset Walk',
        category: 'activity',
        description: 'Flat, sandy beach famous for picturesque sunsets and horseback rides along the water.',
        recommendedDurationMinutes: 120,
        bestTimeToVisit: 'Evening',
        estimatedCostINR: 50,
        latitude: 18.5700,
        longitude: 72.9000,
        highlights: ['Golden hour sunset', 'Shallow waters', 'Coconut palms'],
        whyRecommended: 'The premier sunset destination in the region.',
        accepted: true,
      },
      {
        id: 'fb-alibag-5',
        name: 'Sanman Coastal Seafood',
        category: 'dining',
        description: 'Legendary restaurant serving authentic Gomantak-style surmai fry, prawn curry, and sol kadhi.',
        recommendedDurationMinutes: 75,
        bestTimeToVisit: 'Evening',
        estimatedCostINR: 650,
        latitude: 18.6414,
        longitude: 72.8722,
        highlights: ['Fresh seafood thali', 'Sol Kadhi', 'Local spices'],
        whyRecommended: 'Celebrated as the most authentic local culinary experience in Alibag.',
        accepted: true,
      },
      {
        id: 'fb-alibag-6',
        name: 'Kihim Beach & Bird Sanctuary',
        category: 'activity',
        description: 'Lush coastal grove with diverse migratory birds, wild orchids, and butterfly trails.',
        recommendedDurationMinutes: 90,
        bestTimeToVisit: 'Morning',
        estimatedCostINR: 0,
        latitude: 18.7200,
        longitude: 72.8700,
        highlights: ['Birdwatching', 'Quiet nature trail', 'Dense greenery'],
        whyRecommended: 'Peaceful nature escape for photography and quiet walks.',
        accepted: true,
      },
    ];
  }

  // Generic destination fallback
  return [
    {
      id: 'fb-gen-1',
      name: `${destination} Historic Old Town`,
      category: 'activity',
      description: 'Explore the storied streets, colonial heritage buildings, and artisan workshops.',
      recommendedDurationMinutes: 120,
      bestTimeToVisit: 'Morning',
      estimatedCostINR: 150,
      latitude: 15.4989,
      longitude: 73.8278,
      highlights: ['Heritage architecture', 'Artisan boutiques', 'Photo stops'],
      whyRecommended: `Essential cultural immersion in ${destination}.`,
      accepted: true,
    },
    {
      id: 'fb-gen-2',
      name: `${destination} Scenic Sunset Viewpoint`,
      category: 'activity',
      description: 'Elevated panoramic viewpoint overlooking the city horizon and surrounding landscape.',
      recommendedDurationMinutes: 75,
      bestTimeToVisit: 'Evening',
      estimatedCostINR: 50,
      latitude: 15.5020,
      longitude: 73.8340,
      highlights: ['Panoramic views', 'Golden hour', 'Great photography'],
      whyRecommended: 'The best spot to watch the sunset and capture unforgettable memories.',
      accepted: true,
    },
    {
      id: 'fb-gen-3',
      name: `Central Culinary Market & Eateries`,
      category: 'dining',
      description: 'Vibrant local bazaar with authentic food stalls, fresh specialties, and rich aromas.',
      recommendedDurationMinutes: 90,
      bestTimeToVisit: 'Afternoon',
      estimatedCostINR: 450,
      latitude: 15.4950,
      longitude: 73.8210,
      highlights: ['Local street delicacies', 'Fresh spices', 'Lively vibe'],
      whyRecommended: 'Tasting the true regional flavors and local food culture.',
      accepted: true,
    },
    {
      id: 'fb-gen-4',
      name: `${destination} Nature Trail & Botanical Garden`,
      category: 'activity',
      description: 'Lush green sanctuary with serene walking trails, native trees, and peaceful water bodies.',
      recommendedDurationMinutes: 90,
      bestTimeToVisit: 'Morning',
      estimatedCostINR: 80,
      latitude: 15.5100,
      longitude: 73.8150,
      highlights: ['Peaceful greenery', 'Walking paths', 'Fresh air'],
      whyRecommended: 'A serene nature retreat balancing your trip pace.',
      accepted: true,
    },
  ];
}

