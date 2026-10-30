'use client';

import { useState, useEffect } from 'react';
import type { Trip, TripPreferences, ItineraryDayRecord } from '@/lib/types';
import type { SuggestedPlace } from '@/lib/gemini';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import {
  Sparkles, X, Check, CheckCircle2, Plus, Ban, Loader2,
  Clock, IndianRupee, MapPin, Compass, Search, RefreshCw,
  UtensilsCrossed, Activity, ShieldCheck, ChevronRight
} from 'lucide-react';

interface AIPlaceDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  preferences: TripPreferences | null;
  days: ItineraryDayRecord[];
  onPlacesAdded: () => Promise<void>;
}

export default function AIPlaceDiscoveryModal({
  isOpen,
  onClose,
  trip,
  preferences,
  days,
  onPlacesAdded,
}: AIPlaceDiscoveryModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [places, setPlaces] = useState<SuggestedPlace[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [targetDayId, setTargetDayId] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const destination = trip?.destination || trip?.name || 'Goa';

  // Fetch places when opened if empty
  useEffect(() => {
    if (isOpen && places.length === 0) {
      fetchPlaces();
      if (days.length > 0) {
        setTargetDayId(days[0].id);
      }
    }
  }, [isOpen]);

  async function fetchPlaces(additionalPrompt?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gemini/suggest-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          travelStyle: preferences?.travel_style || 'Balanced',
          interests: preferences?.interests || ['Highlights', 'Sightseeing', 'Food'],
          budget: preferences?.total_budget,
          transport: preferences?.transport_preferences || [],
          food: Array.isArray(preferences?.food_preferences)
            ? preferences.food_preferences.join(', ')
            : preferences?.food_preferences,
          specialRequirements: preferences?.special_requirements,
          additionalPrompt: additionalPrompt || customPrompt,
          count: 8,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch places');
      }

      if (Array.isArray(data.places)) {
        if (additionalPrompt) {
          // Append new places
          setPlaces(prev => [...prev, ...data.places]);
          setCustomPrompt('');
        } else {
          setPlaces(data.places);
        }
      }
    } catch (err: any) {
      console.error('Error fetching places:', err);
      setError(err?.message || 'Could not load recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleToggleAccept(id: string) {
    setPlaces(prev =>
      prev.map(p => (p.id === id ? { ...p, accepted: !p.accepted } : p))
    );
  }

  function handleSelectAll(accepted: boolean) {
    setPlaces(prev => prev.map(p => ({ ...p, accepted })));
  }

  const acceptedCount = places.filter(p => p.accepted).length;

  const filteredPlaces = places.filter(p => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'accepted') return p.accepted;
    if (selectedCategory === 'dining') return p.category === 'dining';
    if (selectedCategory === 'activity') return p.category === 'activity';
    return true;
  });

  async function handleAddAcceptedPlaces() {
    const accepted = places.filter(p => p.accepted);
    if (accepted.length === 0) {
      alert('Please accept at least one place to add to your itinerary.');
      return;
    }

    setSubmitting(true);
    try {
      const chosenDay = days.find(d => d.id === targetDayId) || days[0];
      const baseDate = chosenDay?.day_date || new Date().toISOString().split('T')[0];

      let startHour = 10;
      for (const place of accepted) {
        // 1. Save location
        const locRef = doc(collection(db, 'locations'));
        await setDoc(locRef, {
          id: locRef.id,
          name: place.name,
          category: place.category === 'dining' ? 'restaurant' : 'attraction',
          latitude: place.latitude,
          longitude: place.longitude,
          address: place.address || null,
          recommended_duration: `${place.recommendedDurationMinutes} minutes`,
          entry_fee: 0,
          estimated_spending: place.estimatedCostINR || 0,
          description: place.description,
        });

        // 2. Save itinerary item
        const durHours = Math.max(1, Math.round(place.recommendedDurationMinutes / 60));
        const endHour = startHour + durHours;
        const shStr = `${baseDate}T${startHour.toString().padStart(2, '0')}:00:00.000Z`;
        const ehStr = `${baseDate}T${endHour.toString().padStart(2, '0')}:00:00.000Z`;

        const itemRef = doc(collection(db, 'itinerary_items'));
        await setDoc(itemRef, {
          id: itemRef.id,
          trip_id: trip?.id,
          itinerary_day_id: chosenDay?.id || null,
          location_id: locRef.id,
          type: place.category,
          label: place.name,
          start_time: shStr,
          end_time: ehStr,
          cost: place.estimatedCostINR || 0,
          default_split_type: 'equal',
          status: 'active',
          short_description: place.description,
          estimated_travel_time: '~15 minutes',
          travel_distance_km: 5,
          conflicts: [],
        });

        startHour = Math.min(21, endHour + 1);
      }

      await onPlacesAdded();
      onClose();
    } catch (err: any) {
      console.error('Error adding places to itinerary:', err);
      alert('Error adding places: ' + (err?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      data-lenis-prevent="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        data-lenis-prevent="true"
        className="relative w-full max-w-4xl h-[88vh] max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Gemini AI Place Recommendations</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                  {destination}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Accept or reject places tailored to your style. Accepted places will be added to your itinerary.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Category filter + Select all + Target Day */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'all', label: `All (${places.length})` },
              { id: 'accepted', label: `Accepted (${acceptedCount})` },
              { id: 'activity', label: 'Activities & Sights' },
              { id: 'dining', label: 'Food & Dining' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSelectAll(true)}
              className="text-xs text-indigo-600 hover:underline font-medium cursor-pointer"
            >
              Accept All
            </button>
            <span className="text-slate-300">•</span>
            <button
              onClick={() => handleSelectAll(false)}
              className="text-xs text-slate-500 hover:underline cursor-pointer"
            >
              Reject All
            </button>
          </div>
        </div>

        {/* Custom Prompt Bar */}
        <div className="px-5 py-2.5 bg-indigo-50/40 border-b border-indigo-100/50 flex items-center gap-2 shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
          <input
            type="text"
            placeholder="Ask AI for something specific (e.g. 'Add vegetarian dinner spots' or 'Find sunset viewpoints')..."
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customPrompt.trim()) {
                fetchPlaces(customPrompt.trim());
              }
            }}
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
          />
          <button
            onClick={() => customPrompt.trim() && fetchPlaces(customPrompt.trim())}
            disabled={loading || !customPrompt.trim()}
            className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition cursor-pointer"
          >
            Ask AI
          </button>
        </div>

        {/* Places List / Grid with Lenis wheel-capture bypass and min-h-0 */}
        <div 
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5"
          data-lenis-prevent="true"
        >
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-semibold">Gemini is searching for top places in {destination}...</p>
              <p className="text-xs text-slate-400">Tailoring by pace, cuisine, and top highlights</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button
                onClick={() => fetchPlaces()}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800"
              >
                Retry
              </button>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No places found in this view. Try switching categories or asking AI for more.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlaces.map(place => {
                const isAccepted = place.accepted !== false;
                return (
                  <div
                    key={place.id}
                    className={`relative rounded-xl p-4 transition-all border flex flex-col justify-between ${
                      isAccepted
                        ? 'bg-white border-emerald-300 shadow-sm ring-1 ring-emerald-400/40'
                        : 'bg-slate-50/80 border-slate-200 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              place.category === 'dining'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {place.category === 'dining' ? (
                              <UtensilsCrossed className="w-2.5 h-2.5" />
                            ) : (
                              <Activity className="w-2.5 h-2.5" />
                            )}
                            {place.category}
                          </span>
                          {place.bestTimeToVisit && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                              {place.bestTimeToVisit}
                            </span>
                          )}
                        </div>

                        {/* Status Chip */}
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Check className="w-3 h-3 stroke-[3]" /> Accepted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            <Ban className="w-3 h-3" /> Skipped
                          </span>
                        )}
                      </div>

                      {/* Name & description */}
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {place.name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {place.description}
                      </p>

                      {/* AI Why Recommended */}
                      {place.whyRecommended && (
                        <div className="mt-2 text-[11px] text-indigo-900 bg-indigo-50/70 rounded-lg p-2 flex items-start gap-1.5 border border-indigo-100/60">
                          <Sparkles className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                          <span>{place.whyRecommended}</span>
                        </div>
                      )}

                      {/* Highlights */}
                      {place.highlights && place.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {place.highlights.map((h, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Cost & Duration */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          ₹{place.estimatedCostINR.toLocaleString('en-IN')}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          ~{place.recommendedDurationMinutes} mins
                        </span>
                      </div>
                    </div>

                    {/* Action buttons (Accept vs Reject) */}
                    <div className="flex items-center gap-2 mt-3.5 pt-2 border-t border-slate-100">
                      {isAccepted ? (
                        <button
                          type="button"
                          onClick={() => handleToggleAccept(place.id)}
                          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" /> Reject / Skip
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleAccept(place.id)}
                          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Accept Place
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Destination Day selector & Submit */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Add to:</span>
            {days.length > 0 ? (
              <select
                value={targetDayId}
                onChange={e => setTargetDayId(e.target.value)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
              >
                {days.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.title || `Day ${d.day_index}`} ({d.day_date})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-500">Day 1</span>
            )}
            <span className="text-xs text-slate-400">
              ({acceptedCount} {acceptedCount === 1 ? 'place' : 'places'} selected)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddAcceptedPlaces}
              disabled={submitting || acceptedCount === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-40 transition"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              )}
              <span>Add {acceptedCount} Places to Itinerary</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

