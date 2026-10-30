'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createTrip, saveTripPreferences } from '@/lib/db';
import { saveItineraryPlanToFirestore, createEmptyTripDays } from '@/lib/generate';
import { getTripPath } from '@/lib/trip-routing';
import type { SuggestedPlace, ItineraryDayPlan } from '@/lib/gemini';
import {
  ChevronRight, ChevronLeft, Loader2, Plane, MapPin, Calendar,
  Users, IndianRupee, Activity, Navigation, Coffee, Sparkles,
  Plus, Check, Ban, UtensilsCrossed, Clock
} from 'lucide-react';

const TRAVEL_STYLES = ['Budget', 'Relaxed', 'Balanced', 'Packed', 'Luxury'];
const INTERESTS_LIST = ['Beaches', 'Food', 'History', 'Culture', 'Adventure', 'Nature', 'Shopping', 'Nightlife', 'Photography', 'Architecture', 'Family'];
const TRANSPORT_LIST = ['Walking', 'Public transport', 'Taxi', 'Rental car', 'Rental bike', 'Mixed'];

export default function CreateTripWizard() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

  // Step 1: Basics
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [travelers, setTravelers] = useState(2);

  // Step 2: Budget & Style
  const [budget, setBudget] = useState('');
  const [travelStyle, setTravelStyle] = useState('Balanced');

  // Step 3: Interests
  const [interests, setInterests] = useState<string[]>([]);
  const [specialReqs, setSpecialReqs] = useState('');

  // Step 4: Logistics
  const [transport, setTransport] = useState<string[]>([]);
  const [food, setFood] = useState('');
  const [accommodation, setAccommodation] = useState('Hotel');

  // Step 5: AI Places Curation
  const [places, setPlaces] = useState<SuggestedPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesFetched, setPlacesFetched] = useState(false);
  const [placesCategoryFilter, setPlacesCategoryFilter] = useState<'all' | 'accepted' | 'activity' | 'dining'>('all');
  const [morePlacesPrompt, setMorePlacesPrompt] = useState('');
  
  // Custom place creation in Step 5
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<'activity' | 'dining' | 'hotel' | 'transfer' | 'other'>('activity');
  const [customCost, setCustomCost] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  const toggleInterest = (i: string) => {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };
  
  const toggleTransport = (t: string) => {
    setTransport(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // Fetch AI suggested places when user moves to Step 5
  async function fetchAIPlaces(additionalPrompt?: string) {
    setLoadingPlaces(true);
    try {
      const res = await fetch('/api/gemini/suggest-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim() || 'Goa',
          travelStyle,
          interests: interests.length > 0 ? interests : ['Sightseeing', 'Food'],
          budget: budget ? parseFloat(budget) : null,
          travelers,
          transport,
          food,
          specialRequirements: specialReqs,
          additionalPrompt: additionalPrompt || morePlacesPrompt,
          count: 10,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to suggest places');

      if (Array.isArray(data.places)) {
        if (additionalPrompt) {
          // Append more places
          setPlaces(prev => [...prev, ...data.places]);
          setMorePlacesPrompt('');
        } else {
          setPlaces(data.places);
        }
        setPlacesFetched(true);
      }
    } catch (err: any) {
      console.error('Error fetching places:', err);
      alert('Could not fetch recommendations: ' + (err?.message || 'Check your internet connection'));
    } finally {
      setLoadingPlaces(false);
    }
  }

  function handleProceedToStep5() {
    setStep(5);
    if (!placesFetched) {
      fetchAIPlaces();
    }
  }

  function togglePlaceAccept(id: string) {
    setPlaces(prev =>
      prev.map(p => (p.id === id ? { ...p, accepted: !p.accepted } : p))
    );
  }

  function handleSetAllPlaces(accepted: boolean) {
    setPlaces(prev => prev.map(p => ({ ...p, accepted })));
  }

  function handleAddCustomPlace() {
    if (!customName.trim()) return;
    const newPlace: SuggestedPlace = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      category: customCategory,
      description: customDescription.trim() || 'User custom activity',
      recommendedDurationMinutes: 90,
      bestTimeToVisit: 'Anytime',
      estimatedCostINR: customCost ? parseFloat(customCost) : 0,
      latitude: places[0]?.latitude || 15.49,
      longitude: places[0]?.longitude || 73.82,
      highlights: ['Custom addition'],
      whyRecommended: 'Added manually by you',
      accepted: true,
    };
    setPlaces(prev => [newPlace, ...prev]);
    setCustomName('');
    setCustomCost('');
    setCustomDescription('');
    setShowAddCustom(false);
  }

  const acceptedPlaces = places.filter(p => p.accepted);

  // Final Action: Create trip and generate full AI itinerary
  async function handleCreateTripWithAI() {
    setLoading(true);
    setLoadingStatus('Creating trip profile...');
    try {
      if (!authUser) throw new Error('Not authenticated');

      // 1. Create Trip & Add member
      const trip = await createTrip({
        name: tripName,
        destination,
        start_date: startDate || null,
        end_date: endDate || null
      }, authUser.id, displayName || authUser.display_name || authUser.email?.split('@')[0] || 'Organizer');

      // 2. Save Preferences
      setLoadingStatus('Saving travel preferences...');
      await saveTripPreferences({
        trip_id: trip.id,
        total_budget: budget ? parseFloat(budget) : null,
        travel_style: travelStyle,
        interests,
        transport_preferences: transport,
        food_preferences: food ? food.split(',').map(s => s.trim()) : [],
        accommodation_preference: accommodation,
        special_requirements: specialReqs
      });

      // 3. Generate structured itinerary with Gemini using accepted places
      setLoadingStatus(`Gemini is organizing ${acceptedPlaces.length} places into your daily schedule...`);
      const genRes = await fetch('/api/gemini/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          startDate: startDate || null,
          endDate: endDate || null,
          acceptedPlaces,
          travelStyle,
          travelers,
          budget: budget ? parseFloat(budget) : null,
        }),
      });

      const genData = await genRes.json();
      if (genData.success && Array.isArray(genData.days)) {
        setLoadingStatus('Saving your personalized itinerary...');
        await saveItineraryPlanToFirestore(trip.id, genData.days as ItineraryDayPlan[]);
      } else {
        // Fallback to empty days if generation failed
        await createEmptyTripDays(trip.id, startDate, endDate);
      }

      // Finish & Redirect
      router.push(getTripPath(trip.id, 'itinerary'));
    } catch (err: any) {
      alert('Error creating trip: ' + err.message);
      setLoading(false);
    }
  }

  // Create Blank Trip (skips AI generation)
  async function handleCreateBlankTrip() {
    setLoading(true);
    setLoadingStatus('Creating empty trip...');
    try {
      if (!authUser) throw new Error('Not authenticated');

      const trip = await createTrip({
        name: tripName,
        destination,
        start_date: startDate || null,
        end_date: endDate || null
      }, authUser.id, displayName || authUser.display_name || authUser.email?.split('@')[0] || 'Organizer');

      await saveTripPreferences({
        trip_id: trip.id,
        total_budget: budget ? parseFloat(budget) : null,
        travel_style: travelStyle,
        interests,
        transport_preferences: transport,
        food_preferences: food ? food.split(',').map(s => s.trim()) : [],
        accommodation_preference: accommodation,
        special_requirements: specialReqs
      });

      await createEmptyTripDays(trip.id, startDate, endDate);
      router.push(getTripPath(trip.id, 'itinerary'));
    } catch (err: any) {
      alert('Error creating trip: ' + err.message);
      setLoading(false);
    }
  }

  const filteredPlaces = places.filter(p => {
    if (placesCategoryFilter === 'all') return true;
    if (placesCategoryFilter === 'accepted') return p.accepted;
    if (placesCategoryFilter === 'dining') return p.category === 'dining';
    if (placesCategoryFilter === 'activity') return p.category === 'activity';
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-on-surface p-4 flex items-center justify-center">
      <div className={`w-full ${step === 5 ? 'max-w-4xl' : 'max-w-2xl'} bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-card overflow-hidden transition-all duration-300`}>
        {/* Header */}
        <div className="p-6 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-glow">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="font-headline-sm text-on-surface font-bold m-0 leading-tight">
                {step === 5 ? 'AI Place Curation' : 'Trip Planner Wizard'}
              </h1>
              <p className="text-secondary font-body-sm m-0 mt-0.5">
                Step {step} of 5 {step === 5 && `• Select places for ${destination || 'your trip'}`}
              </p>
            </div>
          </div>
          <button onClick={() => router.back()} className="text-secondary hover:text-on-surface transition-colors font-body-sm">
            Cancel
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 sm:p-8">
          {/* STEP 1: BASICS */}
          {step === 1 && (
            <div className="animate-in flex flex-col gap-5">
              <h2 className="font-headline-sm font-semibold mb-2">The Basics</h2>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Trip Name *</label>
                <div className="relative">
                  <Plane className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input
                    className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors"
                    placeholder="E.g., Goa Coastal Escape"
                    value={tripName}
                    onChange={e => setTripName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Your Display Name *</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input
                    className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors"
                    placeholder="Alex"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Destination *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input
                    className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors"
                    placeholder="Goa, India / Kyoto, Japan / Manali"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <input
                      type="date"
                      className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <input
                      type="date"
                      className="w-full pl-10 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BUDGET & STYLE */}
          {step === 2 && (
            <div className="animate-in flex flex-col gap-5">
              <h2 className="font-headline-sm font-semibold mb-2">Budget & Travel Style</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Number of Travelers</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <input
                      type="number"
                      min="1"
                      className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors"
                      value={travelers}
                      onChange={e => setTravelers(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Total Budget (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <input
                      type="number"
                      className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors"
                      placeholder="e.g. 40000"
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Travel Pace & Style</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TRAVEL_STYLES.map(style => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setTravelStyle(style)}
                      className={`p-3 rounded-xl border text-center font-body-sm transition-all cursor-pointer ${
                        travelStyle === style
                          ? 'bg-primary text-on-primary border-primary shadow-sm font-semibold'
                          : 'bg-surface-container-low border-outline-variant hover:border-outline text-secondary hover:text-on-surface'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INTERESTS */}
          {step === 3 && (
            <div className="animate-in flex flex-col gap-5">
              <h2 className="font-headline-sm font-semibold mb-2">Interests & Vibe</h2>
              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">What are you most excited to experience?</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS_LIST.map(interest => {
                    const active = interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-4 py-2 rounded-full border font-body-sm transition-all cursor-pointer flex items-center gap-2 ${
                          active
                            ? 'bg-primary text-on-primary border-primary font-semibold shadow-xs'
                            : 'bg-surface-container-lowest border-outline-variant text-secondary hover:bg-surface-container-low'
                        }`}
                      >
                        {active && <Check size={14} className="stroke-[3]" />}
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Special Requests or Notes for Gemini</label>
                <textarea
                  className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors min-h-[90px]"
                  placeholder="e.g. Vegetarian only, traveling with elders, must see sunset cliffs, avoid crowded clubs..."
                  value={specialReqs}
                  onChange={e => setSpecialReqs(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 4: LOGISTICS */}
          {step === 4 && (
            <div className="animate-in flex flex-col gap-5">
              <h2 className="font-headline-sm font-semibold mb-2">Logistics & Comfort</h2>
              <div className="flex flex-col gap-2">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Preferred Transport</label>
                <div className="flex flex-wrap gap-2">
                  {TRANSPORT_LIST.map(t => {
                    const active = transport.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTransport(t)}
                        className={`px-3 py-1.5 rounded-lg border font-body-sm transition-all cursor-pointer flex items-center gap-2 ${
                          active
                            ? 'bg-primary text-on-primary border-primary font-semibold'
                            : 'bg-surface-container-low border-outline-variant text-secondary hover:bg-surface-container-high'
                        }`}
                      >
                        <Navigation size={14} /> {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-semibold text-secondary uppercase tracking-wider">Food & Dining Preferences</label>
                <div className="relative">
                  <Coffee className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input
                    className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl font-body-md focus:border-primary focus:outline-none transition-colors"
                    placeholder="e.g. Local seafood, authentic cafes, street snacks, vegetarian"
                    value={food}
                    onChange={e => setFood(e.target.value)}
                  />
                </div>
              </div>

              {/* Informative Callout for Step 5 */}
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 mt-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles size={16} />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-indigo-950">Next: AI Place Curation</h4>
                  <p className="text-[12px] text-indigo-900/80 leading-relaxed">
                    Gemini AI will suggest top-rated places in <strong>{destination || 'your destination'}</strong> matching your {travelStyle} pace. You can accept the places you like and reject those you don’t before creating your itinerary!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: AI PLACE CURATION */}
          {step === 5 && (
            <div className="animate-in flex flex-col gap-5">
              {/* Top Summary & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant">
                <div>
                  <h2 className="font-headline-sm font-bold text-on-surface">Curate Places for {destination}</h2>
                  <p className="text-secondary text-xs mt-0.5">
                    Accept places you want to visit and reject places you don’t. Gemini will schedule the accepted ones!
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">
                    {acceptedPlaces.length} of {places.length} Accepted
                  </span>
                </div>
              </div>

              {/* Filter Tabs & Bulk Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {[
                    { id: 'all', label: `All (${places.length})` },
                    { id: 'accepted', label: `Accepted (${acceptedPlaces.length})` },
                    { id: 'activity', label: 'Activities & Sights' },
                    { id: 'dining', label: 'Food & Dining' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPlacesCategoryFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                        placesCategoryFilter === tab.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-surface-container-low text-secondary border border-outline-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetAllPlaces(true)}
                    className="text-xs text-primary font-medium hover:underline cursor-pointer"
                  >
                    Accept All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => handleSetAllPlaces(false)}
                    className="text-xs text-secondary hover:underline cursor-pointer"
                  >
                    Reject All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <Plus size={12} /> Add Place
                  </button>
                </div>
              </div>

              {/* Add Custom Place Drawer/Card */}
              {showAddCustom && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3 animate-in">
                  <h4 className="text-xs font-bold text-indigo-950">Add Custom Place to Itinerary</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      placeholder="Place name (e.g. My Favorite Beach Cafe)"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      className="sm:col-span-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                    />
                    <select
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value as any)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="activity">Activity / Sight</option>
                      <option value="dining">Food & Dining</option>
                      <option value="hotel">Accommodation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Est. Cost (₹)"
                      value={customCost}
                      onChange={e => setCustomCost(e.target.value)}
                      className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                    />
                    <input
                      placeholder="Short note or highlights"
                      value={customDescription}
                      onChange={e => setCustomDescription(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPlace}
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Ask Gemini for More Input Bar */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-surface-container-low border border-outline-variant">
                <Sparkles size={16} className="text-primary ml-1 shrink-0" />
                <input
                  type="text"
                  placeholder="Need something specific? (e.g. 'Suggest scenic hiking trails' or 'Vegetarian fine dining')..."
                  value={morePlacesPrompt}
                  onChange={e => setMorePlacesPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && morePlacesPrompt.trim() && fetchAIPlaces(morePlacesPrompt.trim())}
                  className="flex-1 bg-transparent text-xs text-on-surface placeholder-secondary outline-none"
                />
                <button
                  type="button"
                  onClick={() => morePlacesPrompt.trim() && fetchAIPlaces(morePlacesPrompt.trim())}
                  disabled={loadingPlaces || !morePlacesPrompt.trim()}
                  className="px-3 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition cursor-pointer"
                >
                  {loadingPlaces ? <Loader2 size={12} className="animate-spin" /> : 'Ask AI'}
                </button>
              </div>

              {/* Cards Grid */}
              <div 
                className="max-h-[50vh] overflow-y-auto overscroll-contain pr-1"
                data-lenis-prevent="true"
              >
                {loadingPlaces ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3 text-secondary">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <p className="text-sm font-semibold text-on-surface">Gemini is finding the best spots in {destination}...</p>
                    <p className="text-xs text-secondary">Matching your {travelStyle} style and interests in {interests.join(', ') || 'sightseeing'}</p>
                  </div>
                ) : filteredPlaces.length === 0 ? (
                  <div className="py-16 text-center space-y-2 text-secondary text-xs">
                    <p>No places in this view.</p>
                    <button
                      type="button"
                      onClick={() => fetchAIPlaces()}
                      className="px-4 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold"
                    >
                      Reload Places with Gemini
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredPlaces.map(place => {
                      const isAccepted = place.accepted !== false;
                      return (
                        <div
                          key={place.id}
                          className={`rounded-xl p-4 border transition-all flex flex-col justify-between ${
                            isAccepted
                              ? 'bg-surface-container-lowest border-emerald-400/80 shadow-xs ring-1 ring-emerald-400/30'
                              : 'bg-surface-container-low border-outline-variant opacity-60 hover:opacity-90'
                          }`}
                        >
                          <div>
                            {/* Top Badges */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    place.category === 'dining'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {place.category === 'dining' ? (
                                    <UtensilsCrossed size={11} />
                                  ) : (
                                    <Activity size={11} />
                                  )}
                                  {place.category}
                                </span>
                                {place.bestTimeToVisit && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-secondary font-medium">
                                    {place.bestTimeToVisit}
                                  </span>
                                )}
                              </div>

                              {/* Status Chip */}
                              {isAccepted ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Check size={12} className="stroke-[3]" /> Accepted
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-secondary bg-surface-container-high px-2 py-0.5 rounded-full">
                                  <Ban size={12} /> Skipped
                                </span>
                              )}
                            </div>

                            {/* Title & Description */}
                            <h3 className="text-sm font-bold text-on-surface leading-tight">
                              {place.name}
                            </h3>
                            <p className="text-xs text-secondary mt-1 line-clamp-2 leading-relaxed">
                              {place.description}
                            </p>

                            {/* Why recommended */}
                            {place.whyRecommended && (
                              <div className="mt-2 text-[11px] text-primary bg-primary/5 rounded-lg p-2 border border-primary/10 flex items-start gap-1.5">
                                <Sparkles size={12} className="shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{place.whyRecommended}</span>
                              </div>
                            )}

                            {/* Highlights */}
                            {place.highlights && place.highlights.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2.5">
                                {place.highlights.slice(0, 3).map((h, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-2 py-0.5 bg-surface-container-high text-secondary rounded font-medium"
                                  >
                                    {h}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Cost & Duration */}
                            <div className="flex items-center gap-3 text-xs text-secondary mt-3 pt-2 border-t border-outline-variant">
                              <span className="font-semibold text-on-surface">
                                ₹{place.estimatedCostINR.toLocaleString('en-IN')}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                ~{place.recommendedDurationMinutes} mins
                              </span>
                            </div>
                          </div>

                          {/* Toggle Action Button */}
                          <div className="mt-3 pt-2 border-t border-outline-variant">
                            {isAccepted ? (
                              <button
                                type="button"
                                onClick={() => togglePlaceAccept(place.id)}
                                className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-secondary bg-surface-container-high hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Ban size={13} /> Reject / Skip
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => togglePlaceAccept(place.id)}
                                className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Check size={13} className="stroke-[3]" /> Accept Place
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1 || loading}
            className="flex items-center gap-1.5 px-4 py-2 font-body-sm font-medium text-secondary hover:text-on-surface disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(s => Math.min(5, s + 1))}
              disabled={step === 1 && (!tripName || !destination || !displayName)}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl font-body-sm font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : step === 4 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateBlankTrip}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                Skip AI & Create Blank Trip
              </button>
              <button
                type="button"
                onClick={handleProceedToStep5}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl font-body-sm font-medium transition-colors cursor-pointer shadow-sm"
              >
                <Sparkles size={16} />
                <span>Curate Places with AI</span>
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCreateBlankTrip}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                Create Blank Trip
              </button>
              <button
                type="button"
                onClick={handleCreateTripWithAI}
                disabled={loading || acceptedPlaces.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl font-body-sm font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{loadingStatus || 'Generating with Gemini...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate Smart Itinerary ({acceptedPlaces.length} Places)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
