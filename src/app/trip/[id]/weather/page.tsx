'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { Trip, ItineraryItem } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchLiveWeather,
  type LiveWeatherReport,
  OPENWEATHER_API_KEY,
} from '@/lib/weather';
import dynamic from 'next/dynamic';

const ItineraryMap = dynamic(() => import('@/components/ItineraryMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[350px] rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center text-xs font-semibold text-slate-400">
      Loading interactive map...
    </div>
  ),
});
import { KNOWN_COORDINATES } from '@/lib/geocoding';
import {
  runDigitalTwinSimulation,
  PRESET_SCENARIOS,
  type WeatherSimParams,
  type WeatherSimulationResult,
} from '@/lib/weather-simulation';
import {
  Cloud, Sun, CloudRain, Wind, Droplets, Thermometer,
  ShieldCheck, AlertTriangle, Sparkles, RefreshCw, MapPin,
  Clock, Navigation, CheckCircle2, Car, UtensilsCrossed, Hotel, Compass,
  Layers, Radio, ChevronRight, ArrowLeft, ArrowUpRight,
  MessageSquare, ThumbsUp, Share2, Plus, X, Send, Eye, ShieldAlert,
  Sliders, RotateCcw, Zap, Flame, Snowflake, CloudFog
} from 'lucide-react';
import Link from 'next/link';

const COLORS = {
  burgundy: '#0f172a',
  cream: '#f8fafc',
  offWhite: '#ffffff',
  rose: '#2563eb'
};

// Generate realistic destination-tailored entities for the digital twin if empty
function generateSampleDigitalTwinEntities(dest: string, tripId: string, coords?: { lat: number; lon: number }): ItineraryItem[] {
  const clean = dest.toLowerCase();
  
  if (clean.includes('ladak') || clean.includes('leh')) {
    return [
      {
        id: 'sample-leh-1',
        trip_id: tripId,
        type: 'activity',
        label: 'Shanti Stupa Panoramic Viewpoint',
        start_time: '09:00',
        end_time: '11:00',
        cost: 0,
        default_split_type: 'equal',
        status: 'active',
        created_at: new Date().toISOString(),
        location: {
          id: 'loc-1',
          name: 'Shanti Stupa',
          category: 'attraction',
          latitude: 34.1724,
          longitude: 77.5752,
          address: 'Changsba, Leh, Ladakh',
          description: 'High-altitude Buddhist white-domed stupa with 360 panoramic views.',
          entry_fee: 0,
          estimated_spending: 0,
          rating: 4.8,
          created_at: new Date().toISOString(),
          opening_hours: { open: '06:00', close: '19:00' },
          recommended_duration: '2 hours',
          best_time_to_visit: 'Morning',
        }
      },
      {
        id: 'sample-leh-2',
        trip_id: tripId,
        type: 'transfer',
        label: 'Khardung La Pass Transit Corridor',
        start_time: '11:30',
        end_time: '13:30',
        cost: 2500,
        default_split_type: 'equal',
        status: 'active',
        created_at: new Date().toISOString(),
        location: {
          id: 'loc-2',
          name: 'Khardung La Pass',
          category: 'transit',
          latitude: 34.2787,
          longitude: 77.6047,
          address: 'Khardung La Summit, Ladakh',
          description: 'World famous high mountain pass (5,359 m elevation). High wind and icing risk.',
          entry_fee: 0,
          estimated_spending: 2500,
          rating: 4.9,
          created_at: new Date().toISOString(),
          opening_hours: { open: '07:00', close: '17:00' },
          recommended_duration: '2 hours',
          best_time_to_visit: 'Midday',
        }
      },
      {
        id: 'sample-leh-3',
        trip_id: tripId,
        type: 'dining',
        label: 'Chopsticks Himalayan Cafe & Dining',
        start_time: '14:00',
        end_time: '15:30',
        cost: 1200,
        default_split_type: 'equal',
        status: 'active',
        created_at: new Date().toISOString(),
        location: {
          id: 'loc-3',
          name: 'Chopsticks Noodle Bar',
          category: 'restaurant',
          latitude: 34.1610,
          longitude: 77.5830,
          address: 'Main Bazaar, Leh',
          description: 'Indoor heated dining with authentic Tibetan & Himalayan soups.',
          entry_fee: 0,
          estimated_spending: 1200,
          rating: 4.6,
          created_at: new Date().toISOString(),
          opening_hours: { open: '12:00', close: '22:00' },
          recommended_duration: '1.5 hours',
          best_time_to_visit: 'Lunch',
        }
      },
      {
        id: 'sample-leh-4',
        trip_id: tripId,
        type: 'hotel',
        label: 'The Grand Dragon Eco-Resort',
        start_time: '18:00',
        end_time: '23:00',
        cost: 6500,
        default_split_type: 'equal',
        status: 'active',
        created_at: new Date().toISOString(),
        location: {
          id: 'loc-4',
          name: 'The Grand Dragon Ladakh',
          category: 'hotel',
          latitude: 34.1550,
          longitude: 77.5770,
          address: 'Old Road, Sheynam, Leh',
          description: 'Insulated resort with centralized heating and oxygen assistance.',
          entry_fee: 0,
          estimated_spending: 6500,
          rating: 4.9,
          created_at: new Date().toISOString(),
          opening_hours: { open: '00:00', close: '23:59' },
          recommended_duration: 'Overnight',
          best_time_to_visit: 'Night',
        }
      }
    ];
  }

  if (clean.includes('goa')) {
    return [
      {
        id: 'sample-goa-1',
        trip_id: tripId,
        type: 'activity',
        label: 'Baga Beach & Watersports Center',
        start_time: '09:30',
        end_time: '12:00',
        cost: 1500,
        default_split_type: 'equal',
        status: 'active',
        created_at: new Date().toISOString(),
        location: {
          id: 'loc-g1',
          name: 'Baga Beach Watersports',
          category: 'attraction',
          latitude: 15.5553,
          longitude: 73.7517,
          address: 'Baga Beach, North Goa',
          description: 'Golden sandy beach with parasailing, jet-skiing and beach shacks.',
          entry_fee: 0,
          estimated_spending: 1500,
          rating: 4.7,
          created_at: new Date().toISOString(),
          opening_hours: { open: '07:00', close: '19:00' },
          recommended_duration: '2.5 hours',
          best_time_to_visit: 'Morning',
        }
      },
      {
        id: 'sample-goa-2',
        trip_id: tripId,
        type: 'activity',
        label: 'Fort Aguada Ramparts & Lighthouse',
        start_time: '13:00',
        end_time: '15:00',
        cost: 300,
        default_split_type: 'equal',
        status: 'active',
        created_at: new Date().toISOString(),
        location: {
          id: 'loc-g2',
          name: 'Fort Aguada',
          category: 'attraction',
          latitude: 15.4925,
          longitude: 73.7736,
          address: 'Candolim, Goa',
          description: '17th-century Portuguese fortress overlooking the vast Arabian Sea.',
          entry_fee: 50,
          estimated_spending: 300,
          rating: 4.8,
          created_at: new Date().toISOString(),
          opening_hours: { open: '09:30', close: '17:30' },
          recommended_duration: '2 hours',
          best_time_to_visit: 'Afternoon',
        }
      },
      {
        id: 'sample-goa-3',
        trip_id: tripId,
        type: 'dining',
        label: 'Fishermans Wharf Waterfront Seafood',
        start_time: '15:30',
        end_time: '17:30',
        cost: 1800,
        default_split_type: 'equal',
        status: 'active',
        created_at: new Date().toISOString(),
        location: {
          id: 'loc-g3',
          name: 'Fishermans Wharf Panaji',
          category: 'restaurant',
          latitude: 15.5000,
          longitude: 73.8278,
          address: 'Panaji, Goa',
          description: 'Riverside open-air dining serving authentic Goan prawn curry and fish recheado.',
          entry_fee: 0,
          estimated_spending: 1800,
          rating: 4.7,
          created_at: new Date().toISOString(),
          opening_hours: { open: '12:00', close: '23:00' },
          recommended_duration: '2 hours',
          best_time_to_visit: 'Lunch',
        }
      },
      {
        id: 'sample-goa-4',
        trip_id: tripId,
        type: 'hotel',
        label: 'Taj Fort Aguada Coastal Resort',
        start_time: '18:30',
        end_time: '23:59',
        cost: 8500,
        default_split_type: 'equal',
        status: 'active',
        created_at: new Date().toISOString(),
        location: {
          id: 'loc-g4',
          name: 'Taj Fort Aguada Resort',
          category: 'hotel',
          latitude: 15.4950,
          longitude: 73.7700,
          address: 'Sinquerim, Candolim, Goa',
          description: 'Luxury beachfront resort with oceanfront infinity pool and tropical gardens.',
          entry_fee: 0,
          estimated_spending: 8500,
          rating: 4.9,
          created_at: new Date().toISOString(),
          opening_hours: { open: '00:00', close: '23:59' },
          recommended_duration: 'Overnight',
          best_time_to_visit: 'Evening',
        }
      }
    ];
  }

  // Dynamic entities tailored to destination coordinates
  const baseLat = 15.2993;
  const baseLon = 74.1240;
  const placeName = dest || 'Destination';

  return [
    {
      id: `sample-dyn-1`,
      trip_id: tripId,
      type: 'activity',
      label: `${placeName} Central Cultural Landmark`,
      start_time: '09:30',
      end_time: '12:00',
      cost: 500,
      default_split_type: 'equal',
      status: 'active',
      created_at: new Date().toISOString(),
      location: {
        id: `loc-d1`,
        name: `${placeName} Landmark`,
        category: 'attraction',
        latitude: baseLat + 0.012,
        longitude: baseLon + 0.008,
        address: `${placeName} Center`,
        description: `Primary outdoor heritage and sightseeing attraction in ${placeName}.`,
        entry_fee: 100,
        estimated_spending: 500,
        rating: 4.8,
        created_at: new Date().toISOString(),
        opening_hours: { open: '08:30', close: '18:00' },
        recommended_duration: '2.5 hours',
        best_time_to_visit: 'Morning',
      }
    },
    {
      id: `sample-dyn-2`,
      trip_id: tripId,
      type: 'transfer',
      label: `${placeName} Regional Transit Corridor`,
      start_time: '12:30',
      end_time: '13:30',
      cost: 400,
      default_split_type: 'equal',
      status: 'active',
      created_at: new Date().toISOString(),
      location: {
        id: `loc-d2`,
        name: `${placeName} Transit Hub`,
        category: 'transit',
        latitude: baseLat - 0.008,
        longitude: baseLon - 0.012,
        address: `${placeName} Express Terminal`,
        description: `Central transit corridor connecting regional hubs and tourist transfer links.`,
        entry_fee: 0,
        estimated_spending: 400,
        rating: 4.5,
        created_at: new Date().toISOString(),
        opening_hours: { open: '06:00', close: '22:00' },
        recommended_duration: '1 hour',
        best_time_to_visit: 'Midday',
      }
    },
    {
      id: `sample-dyn-3`,
      trip_id: tripId,
      type: 'dining',
      label: `${placeName} Artisan Local Bistro`,
      start_time: '14:00',
      end_time: '15:30',
      cost: 1400,
      default_split_type: 'equal',
      status: 'active',
      created_at: new Date().toISOString(),
      location: {
        id: `loc-d3`,
        name: `${placeName} Dining Hub`,
        category: 'restaurant',
        latitude: baseLat + 0.005,
        longitude: baseLon - 0.005,
        address: `${placeName} Boulevard`,
        description: `Acclaimed local restaurant with shaded terrace seating and regional delicacies.`,
        entry_fee: 0,
        estimated_spending: 1400,
        rating: 4.7,
        created_at: new Date().toISOString(),
        opening_hours: { open: '11:00', close: '23:00' },
        recommended_duration: '1.5 hours',
        best_time_to_visit: 'Lunch',
      }
    },
    {
      id: `sample-dyn-4`,
      trip_id: tripId,
      type: 'hotel',
      label: `${placeName} Heritage Resort & Retreat`,
      start_time: '18:00',
      end_time: '23:59',
      cost: 5500,
      default_split_type: 'equal',
      status: 'active',
      created_at: new Date().toISOString(),
      location: {
        id: `loc-d4`,
        name: `${placeName} Heritage Resort`,
        category: 'hotel',
        latitude: baseLat - 0.015,
        longitude: baseLon + 0.015,
        address: `${placeName} Valley`,
        description: `Premier accommodation with hospitality facilities and scenic vantage points.`,
        entry_fee: 0,
        estimated_spending: 5500,
        rating: 4.9,
        created_at: new Date().toISOString(),
        opening_hours: { open: '00:00', close: '23:59' },
        recommended_duration: 'Overnight',
        best_time_to_visit: 'Evening',
      }
    }
  ];
}

export default function WeatherDigitalTwinPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params?.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [weatherReport, setWeatherReport] = useState<LiveWeatherReport | null>(null);
      const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ── REQUIREMENT 4: DIGITAL TWIN WHAT-IF SIMULATION STATE ──
  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [activePresetKey, setActivePresetKey] = useState<string>('live');
  const [simParams, setSimParams] = useState<WeatherSimParams>(PRESET_SCENARIOS.live.params);

  // Reactive simulation results computed continuously
  const simulationResult = useMemo<WeatherSimulationResult>(() => {
    return runDigitalTwinSimulation(simParams, items, weatherReport);
  }, [simParams, items, weatherReport]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let destination = '';
      let tripName = '';

      if (tripId && tripId !== 'view') {
        const tripDoc = await getDoc(doc(db, 'trips', tripId));
        if (tripDoc.exists()) {
          const data = tripDoc.data() as Trip;
          setTrip(data);
          destination = data.destination || data.name || '';
          tripName = data.name || destination;
        }

        // Fetch itinerary items for this trip
        const itemsQ = query(collection(db, 'itinerary_items'), where('trip_id', '==', tripId));
        const locQ = query(collection(db, 'locations'));
        const [itemsRes, locRes] = await Promise.all([getDocs(itemsQ), getDocs(locQ)]);

        const locMap: Record<string, any> = {};
        locRes.docs.forEach(d => {
          locMap[d.id] = { id: d.id, ...d.data() };
        });

        let loadedItems: ItineraryItem[] = itemsRes.docs.map(d => ({
          id: d.id,
          ...d.data(),
          location: d.data().location_id ? locMap[d.data().location_id] : undefined,
        })) as ItineraryItem[];

        const firstItemCoords = loadedItems.find(i => i.location?.latitude && i.location?.longitude)?.location;

        // Fetch Live Weather using trip destination and item coordinates
        const report = await fetchLiveWeather(destination, firstItemCoords?.latitude ?? undefined, firstItemCoords?.longitude ?? undefined);
        setWeatherReport(report);

        if (loadedItems.length === 0) {
          loadedItems = generateSampleDigitalTwinEntities(destination, tripId, report?.current.coord);
        } else {
          const baseCoords = report?.current.coord
            ? [report.current.coord.lat, report.current.coord.lon]
            : (KNOWN_COORDINATES[destination.toLowerCase().replace(/[^a-z]/g, '')] || [15.2993, 74.1240]);
          loadedItems = loadedItems.map((item, idx) => {
            if (!item.location || typeof item.location.latitude !== 'number') {
              return {
                ...item,
                location: {
                  id: `loc-gen-${idx}`,
                  name: item.label,
                  category: item.type === 'activity' ? 'attraction' : item.type === 'dining' ? 'restaurant' : 'transit',
                  latitude: baseCoords[0] + (idx * 0.015 - 0.02),
                  longitude: baseCoords[1] + (idx * 0.012 - 0.015),
                  address: `${item.label}, ${destination || report?.destination || 'Destination'}`,
                  description: item.short_description || 'Itinerary stop',
                  entry_fee: item.cost || 0,
                  estimated_spending: item.cost || 0,
                  rating: 4.8,
                  created_at: new Date().toISOString(),
                  opening_hours: { open: '08:00', close: '20:00' },
                  recommended_duration: '2 hours',
                  best_time_to_visit: 'Flexible',
                }
              };
            }
            return item;
          });
        }

        setItems(loadedItems);

        // Seed initial simulation parameters with real OpenWeather baseline
        if (report?.current) {
          setSimParams({
            rain_intensity_mm: report.current.rain_1h || 0,
            temperature_c: report.current.temp,
            wind_speed_kmh: report.current.wind_speed,
            storm_duration_hours: 1,
            propagation_radius_km: 15,
            scenario_preset: 'live',
          });
        }

        } else {
        const report = await fetchLiveWeather('Goa');
        setWeatherReport(report);
        setItems(generateSampleDigitalTwinEntities('Goa', 'preview', report?.current.coord));
        }

    } catch (err) {
      console.error('Failed to load live weather:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    try {
      const dest = trip?.destination || trip?.name || '';
      const firstItemCoords = items.find(i => i.location?.latitude && i.location?.longitude)?.location;
      const report = await fetchLiveWeather(dest, firstItemCoords?.latitude ?? undefined, firstItemCoords?.longitude ?? undefined);
      setWeatherReport(report);

      if (!simulationActive && report?.current) {
        setSimParams({
          rain_intensity_mm: report.current.rain_1h || 0,
          temperature_c: report.current.temp,
          wind_speed_kmh: report.current.wind_speed,
          storm_duration_hours: 1,
          propagation_radius_km: 15,
          scenario_preset: 'live',
        });
      }

      } catch (e) {
      console.warn('Weather sync error:', e);
    } finally {
      setSyncing(false);
    }
  }

  function handleSelectPreset(key: string) {
    setActivePresetKey(key);
    if (key === 'live') {
      if (weatherReport?.current) {
        setSimParams({
          rain_intensity_mm: weatherReport.current.rain_1h || 0,
          temperature_c: weatherReport.current.temp,
          wind_speed_kmh: weatherReport.current.wind_speed,
          storm_duration_hours: 1,
          propagation_radius_km: 15,
          scenario_preset: 'live',
        });
      }
      setSimulationActive(false);
    } else {
      setSimParams(PRESET_SCENARIOS[key].params);
      setSimulationActive(true);
    }
  }

  function handleSliderChange(paramKey: keyof WeatherSimParams, val: number) {
    setActivePresetKey('custom');
    setSimulationActive(true);
    setSimParams(prev => ({
      ...prev,
      [paramKey]: val,
      scenario_preset: 'custom',
    }));
  }

  function handleResetLive() {
    setActivePresetKey('live');
    setSimulationActive(false);
    if (weatherReport?.current) {
      setSimParams({
        rain_intensity_mm: weatherReport.current.rain_1h || 0,
        temperature_c: weatherReport.current.temp,
        wind_speed_kmh: weatherReport.current.wind_speed,
        storm_duration_hours: 1,
        propagation_radius_km: 15,
        scenario_preset: 'live',
      });
    }
  }

  function formatDayDate(dateStr: string) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="space-y-6 pb-24 font-['Inter']">
      
      {/* ── TOP HERO BANNER ── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border border-indigo-100/90 bg-gradient-to-br from-white via-indigo-50/30 to-sky-50/40 p-8 shadow-xl backdrop-blur-md"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Weather-Driven Digital Twin
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {weatherReport?.source === 'OpenWeather' 
                  ? 'OpenWeather Live Connected' 
                  : 'Live Meteorological Sensor Stream'}
              </span>

              {simulationActive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-600 text-white shadow-md animate-pulse">
                  <Zap className="w-3.5 h-3.5 text-yellow-300" />
                  What-If Counterfactual Mode Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                  <Radio className="w-3 h-3 text-slate-500" />
                  Live Ground Telemetry
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Environmental Conditions & Cascading Digital Twin
            </h1>

            <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">
                {weatherReport?.destination || trip?.destination || trip?.name || 'Trip Destination'}
              </span>
              {weatherReport?.current.coord && (
                <span className="text-slate-400">
                  ({weatherReport.current.coord.lat.toFixed(2)}°N, {weatherReport.current.coord.lon.toFixed(2)}°E)
                </span>
              )}
              <span className="text-slate-300">•</span>
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Synced {weatherReport?.last_updated ? new Date(weatherReport.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/trip/${tripId}/itinerary`}
              prefetch={true}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Itinerary Timeline</span>
            </Link>

            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: COLORS.burgundy }}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing Feeds...' : 'Sync Live Weather'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── REQUIREMENT 4: DIGITAL TWIN WHAT-IF COUNTERFACTUAL SIMULATION STUDIO ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-7 rounded-[2rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-2xl space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/40">
                <Sliders className="w-4 h-4 text-blue-500" />
              </span>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Digital Twin What-If & Counterfactual Scenario Simulator</span>
                  {simulationActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white">
                      SIMULATION ACTIVE
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-300">
                  Alter precipitation intensity, temperature shifts, storm duration, and wind velocity to observe real-time cascading effects on transit, outdoor demand, and schedule viability.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {simulationActive ? (
              <button
                type="button"
                onClick={handleResetLive}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-slate-200 bg-white/10 hover:bg-white/20 border border-white/20 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Live Ground Truth</span>
              </button>
            ) : (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>System in Optimal Baseline</span>
              </span>
            )}
          </div>
        </div>

        {/* 5 Scenario Presets */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Interactive Scenario Presets:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {[
              { key: 'live', name: '☀️ Live Baseline', icon: Sun },
              { key: 'blizzard', name: '❄️ Mountain Blizzard', icon: Snowflake },
              { key: 'cloudburst', name: '🌧️ Flash Cloudburst', icon: CloudRain },
              { key: 'heatwave', name: '🔥 Extreme Heatwave', icon: Flame },
              { key: 'fog_inversion', name: '🌫️ Dense Valley Fog', icon: CloudFog },
            ].map(preset => {
              const isSelected = activePresetKey === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleSelectPreset(preset.key)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg ring-2 ring-blue-400/50'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-extrabold flex items-center gap-1.5 mb-1">
                    <span>{preset.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1">
                    {PRESET_SCENARIOS[preset.key]?.description || 'Scenario'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Parameter Sliders Deck */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
          
          {/* Slider 1: Rainfall Intensity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-blue-400" /> Rain Intensity
              </span>
              <span className="text-sky-300 font-mono font-black">{simParams.rain_intensity_mm} mm/h</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              step="5"
              value={simParams.rain_intensity_mm}
              onChange={e => handleSliderChange('rain_intensity_mm', Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
            <span className="text-[10px] text-slate-400 block">{simParams.rain_intensity_mm > 40 ? 'Severe Torrential Cloudburst' : simParams.rain_intensity_mm > 10 ? 'Moderate Rain' : 'Dry / Clear'}</span>
          </div>

          {/* Slider 2: Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" /> Temperature
              </span>
              <span className="text-amber-300 font-mono font-black">{simParams.temperature_c}°C</span>
            </div>
            <input
              type="range"
              min="-15"
              max="45"
              step="1"
              value={simParams.temperature_c}
              onChange={e => handleSliderChange('temperature_c', Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <span className="text-[10px] text-slate-400 block">{simParams.temperature_c < 0 ? 'Freezing Summit Icing' : simParams.temperature_c > 35 ? 'Extreme Heat Exposure' : 'Temperate Envelope'}</span>
          </div>

          {/* Slider 3: Wind Velocity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300 flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-teal-400" /> Wind Velocity
              </span>
              <span className="text-teal-300 font-mono font-black">{simParams.wind_speed_kmh} km/h</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={simParams.wind_speed_kmh}
              onChange={e => handleSliderChange('wind_speed_kmh', Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
            <span className="text-[10px] text-slate-400 block">{simParams.wind_speed_kmh > 50 ? 'Gale Force High Mountain Gusts' : 'Light Mountain Breeze'}</span>
          </div>

          {/* Slider 4: Storm Duration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-400" /> Duration
              </span>
              <span className="text-purple-300 font-mono font-black">{simParams.storm_duration_hours} hours</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={simParams.storm_duration_hours}
              onChange={e => handleSliderChange('storm_duration_hours', Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
            <span className="text-[10px] text-slate-400 block">Accumulated ground exposure window</span>
          </div>

          {/* Slider 5: Propagation Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-blue-500" /> Storm Radius
              </span>
              <span className="text-blue-400 font-mono font-black">{simParams.propagation_radius_km} km</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={simParams.propagation_radius_km}
              onChange={e => handleSliderChange('propagation_radius_km', Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-400 block">Simulated storm front coverage</span>
          </div>

        </div>

        {/* Live Simulation Cascading Diagnostics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* System Viability Score */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>SYSTEM VIABILITY</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                simulationResult.overall_system_viability_score < 40
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/40'
                  : simulationResult.overall_system_viability_score < 70
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {simulationResult.ecosystem_risk_level.toUpperCase()}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{simulationResult.overall_system_viability_score}%</span>
              <span className="text-xs text-slate-400">Operational Index</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${simulationResult.overall_system_viability_score}%` }}
                className={`h-full transition-all duration-300 ${
                  simulationResult.overall_system_viability_score < 40 ? 'bg-blue-600' : simulationResult.overall_system_viability_score < 70 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>

          {/* Transit & Pass Disruption */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>TRANSIT DISRUPTION</span>
              <span className="text-teal-300 font-extrabold">{simulationResult.transit_disruption_index}/100</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                +{Math.round(simulationResult.transit_disruption_index * 1.2)} min
              </span>
              <span className="text-xs text-slate-400">Avg Convoy Delay</span>
            </div>
            <span className="text-[11px] text-slate-300 block">
              Pass closure probability: <strong>{Math.round(simulationResult.probabilistic_forecast.pass_closure_probability * 100)}%</strong>
            </span>
          </div>

          {/* Attraction Demand & Dining Surge */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>DEMAND SHIFTS</span>
              <span className="text-indigo-300 font-extrabold">Ecosystem Flow</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-300">Outdoor Sightseeing:</span>
              <span className="font-extrabold text-blue-500">{simulationResult.attraction_demand_shift}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Indoor Dining Surge:</span>
              <span className="font-extrabold text-amber-400">+{simulationResult.dining_indoor_surge}%</span>
            </div>
          </div>

          {/* Probabilistic Recovery Prediction */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>RECOVERY PREDICTION</span>
              <span className="text-sky-300 font-extrabold">{Math.round(simulationResult.probabilistic_forecast.delay_propagation_confidence * 100)}% Conf.</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{simulationResult.probabilistic_forecast.estimated_recovery_hours} hrs</span>
              <span className="text-xs text-slate-400">Post-Storm Clearing</span>
            </div>
            <span className="text-[11px] text-slate-300 block">
              Estimated infrastructure reset time
            </span>
          </div>

        </div>

        {/* Automated Mitigation Actions Generated by the Simulation */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-yellow-400" /> Automated Digital Twin Operational Adjustments:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-200">
            {simulationResult.recommended_twin_actions.map((act, i) => (
              <div key={i} className="flex items-start gap-2 bg-white/5 p-2.5 rounded-xl border border-white/5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{act}</span>
              </div>
            ))}
          </div>
        </div>

      </motion.div>

      {/* ── REQUIREMENT 2: GEOSPATIAL MAP VISUALIZATION WITH RADAR & SOCIAL SIGNAL PINS ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-7 rounded-[2rem] bg-white border border-slate-200/90 shadow-lg space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200/60 shadow-2xs">
                <Navigation className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Geospatial Digital Twin & Weather Impact Propagation
                </h2>
                <p className="text-xs text-slate-500">
                  {simulationActive 
                    ? `Simulating counterfactual: ${simParams.rain_intensity_mm}mm/h rain, ${simParams.temperature_c}°C temp, ${simParams.wind_speed_kmh}km/h gusts within ${simParams.propagation_radius_km}km perimeter.`
                    : 'Interactive Leaflet map displaying real-time OpenWeather radar tiles, entity vulnerability halos, and propagation storm circles.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {simulationActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-100 text-red-800 font-extrabold border border-blue-300 animate-pulse">
                <Zap className="w-3.5 h-3.5 text-red-600" />
                <span>Map Reflecting What-If Parameters</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>OpenWeather Tiles: Active</span>
              </span>
            )}
          </div>
        </div>

        {/* Map Grid: Large Leaflet Map + Side Entity Vulnerability Diagnostics Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Map Column (8 Columns) */}
          <div
            className="lg:col-span-8 space-y-3 overscroll-contain"
            data-lenis-prevent
            data-lenis-prevent-wheel
            data-lenis-prevent-touch
          >
            <ItineraryMap
              items={items}
              destination={trip?.destination || trip?.name || weatherReport?.destination || 'Destination'}
              highlightedItemId={highlightedItemId}
              weatherReport={simulationActive ? {
                ...weatherReport!,
                current: {
                  ...weatherReport!.current,
                  temp: simParams.temperature_c,
                  rain_1h: simParams.rain_intensity_mm,
                  wind_speed: simParams.wind_speed_kmh,
                  condition: simParams.rain_intensity_mm > 30 ? 'Rain' : simParams.temperature_c < 0 ? 'Snow' : weatherReport!.current.condition,
                }
              } : weatherReport}
              
              initialDigitalTwinMode={true}
              initialWeatherLayer={simulationActive && simParams.rain_intensity_mm > 0 ? 'precipitation' : 'precipitation'}
              showPropagationControls={true}
              onMarkerClick={(itemId) => setHighlightedItemId(itemId)}
            />

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${simulationActive ? 'bg-blue-600 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                <span className="font-semibold text-slate-800">
                  {simulationActive ? 'Simulated Digital Twin Geometry' : 'Leaflet Digital Twin Engine'}
                </span>
                <span className="text-slate-400">•</span>
                <span>Click pins for micro-climate diagnostics and active vulnerability status.</span>
              </div>
              <span className="text-indigo-600 font-bold">
                {items.length} Itinerary Entities Monitored
              </span>
            </div>
          </div>

          {/* Side Entity Vulnerability Diagnostics Matrix (4 Columns) */}
          <div className="lg:col-span-4 flex flex-col space-y-3">
            {/* 1. Twin Vulnerability Index */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  Twin Vulnerability Index
                </span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  {simulationActive ? 'Simulated' : 'Live'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-snug">
                {simulationActive 
                  ? 'Entities dynamically impacted by the active What-If simulation parameters.' 
                  : 'Entities continuously evaluated against OpenWeather atmospheric readings and storm propagation distance.'}
              </p>
            </div>

            {/* 2. Atmospheric Sensor Telemetry (Filled right alongside the map) */}
            {weatherReport && (
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Atmospheric Telemetry
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {simulationActive ? '⚡ Counterfactual Mode' : 'OpenWeather Feed'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tight text-slate-900">
                      {simulationActive ? simParams.temperature_c : weatherReport.current.temp}°C
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {simulationActive ? 'Simulated' : `Feels ${weatherReport.current.feels_like}°C`}
                    </span>
                  </div>
                  <span className="text-xs text-slate-700 font-semibold capitalize flex items-center gap-1">
                    {weatherReport.current.condition === 'Clear' ? (
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    ) : weatherReport.current.condition.toLowerCase().includes('rain') ? (
                      <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <Cloud className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    {weatherReport.current.description}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span>Humidity: <strong className="text-slate-800">{simulationActive ? (simParams.rain_intensity_mm > 0 ? 92 : 25) : weatherReport.current.humidity}%</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Wind: <strong className="text-slate-800">{simulationActive ? simParams.wind_speed_kmh : weatherReport.current.wind_speed} km/h</strong></span>
                </div>

                {/* 6 Sensor Metric Cards */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100">
                  <div className="p-1.5 rounded-xl bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Wind</span>
                    <span className="text-[11px] font-extrabold text-slate-800">
                      {simulationActive ? simParams.wind_speed_kmh : weatherReport.current.wind_speed} km/h
                    </span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Rain Vol</span>
                    <span className="text-[11px] font-extrabold text-slate-800">
                      {simulationActive ? simParams.rain_intensity_mm : weatherReport.current.rain_1h} mm/h
                    </span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Clouds</span>
                    <span className="text-[11px] font-extrabold text-slate-800">
                      {simulationActive ? (simParams.rain_intensity_mm > 0 ? 100 : 15) : weatherReport.current.clouds}%
                    </span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Min / Max</span>
                    <span className="text-[11px] font-extrabold text-slate-800">
                      {simulationActive ? `${simParams.temperature_c - 4}° / ${simParams.temperature_c + 3}°` : `${weatherReport.current.temp_min}° / ${weatherReport.current.temp_max}°`}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Pressure</span>
                    <span className="text-[11px] font-extrabold text-slate-800">
                      {weatherReport.current.pressure} hPa
                    </span>
                  </div>
                  <div className="p-1.5 rounded-xl bg-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Visibility</span>
                    <span className="text-[11px] font-extrabold text-slate-800">
                      {simulationActive && simParams.rain_intensity_mm > 30 ? '1.5 km' : `${(weatherReport.current.visibility / 1000).toFixed(1)} km`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. List of Impacted Entities (dynamically backed by simulation results) */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {simulationResult.impacted_entities.map((simEntity, idx) => {
                const isSelected = highlightedItemId === simEntity.itemId;
                const isSevere = simEntity.simulatedRisk === 'severe';
                const isModerate = simEntity.simulatedRisk === 'moderate';

                return (
                  <div
                    key={simEntity.itemId}
                    onClick={() => setHighlightedItemId(simEntity.itemId)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 shadow-md ring-2 ring-blue-200'
                        : isSevere
                        ? 'bg-blue-50/40 border-red-200 hover:border-blue-300'
                        : isModerate
                        ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        Stop {idx + 1} • {simEntity.itemType}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isSevere
                          ? 'bg-red-100 text-red-800 border border-blue-300'
                          : isModerate
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {isSevere ? `Alert +${simEntity.transitDelayMinutes}m` : isModerate ? `Buffer +${simEntity.transitDelayMinutes}m` : 'Normal Envelope'}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900 truncate">
                      {simEntity.itemLabel}
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                      {simEntity.operationalStatus}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-2 mt-2 border-t border-slate-100">
                      <span>Mitigation: {simEntity.rescheduleRecommended ? 'Reschedule Proposed' : 'Buffer Applied'}</span>
                      <span className="text-indigo-600 flex items-center gap-0.5 hover:underline">
                        Focus on Map <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </motion.div>

      {/* ── AI DIGITAL TWIN ECOSYSTEM IMPACT ASSESSMENT & DOMAIN CASCADE ── */}
      {weatherReport && (
        <div className="p-7 rounded-[2rem] bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white shadow-xl space-y-6">
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white/10 text-indigo-300 border border-white/10">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Ecosystem Impact Engine
                </span>
                
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  (simulationActive ? simulationResult.ecosystem_risk_level : weatherReport.impact_assessment.risk_level) === 'severe'
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/40'
                    : (simulationActive ? simulationResult.ecosystem_risk_level : weatherReport.impact_assessment.risk_level) === 'high'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : (simulationActive ? simulationResult.ecosystem_risk_level : weatherReport.impact_assessment.risk_level) === 'moderate'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Status: {(simulationActive ? simulationResult.ecosystem_risk_level : weatherReport.impact_assessment.risk_level).toUpperCase()} RISK ({simulationActive ? `${Math.round(simulationResult.probabilistic_forecast.delay_propagation_confidence * 100)}% Sim Confidence` : `${Math.round((weatherReport.impact_assessment.confidence_score || 0.95) * 100)}% Confidence`})
                </span>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-white pt-2">
                Operational Status & Cascading Forecast
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed">
                {simulationActive 
                  ? `Counterfactual simulation results: Viability score at ${simulationResult.overall_system_viability_score}%. Transit delays averaging +${Math.round(simulationResult.transit_disruption_index * 1.2)}m with ${Math.round(simulationResult.probabilistic_forecast.pass_closure_probability * 100)}% pass closure probability.`
                  : weatherReport.impact_assessment.impact_summary}
              </p>
            </div>

            {/* 4 Cascading Domain Impacts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                  <Car className="w-4 h-4 text-teal-400" />
                  <span>Transit & Road Corridors</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  {simulationActive && simulationResult.transit_disruption_index > 50
                    ? `Convoy delays of +${Math.round(simulationResult.transit_disruption_index * 1.2)}m. Mountain passes face icing and reduced passability.`
                    : 'High-altitude mountain roads & transit lines report normal passability. Mountain passes operating on standard schedule.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <Compass className="w-4 h-4 text-indigo-400" />
                  <span>Outdoor Attractions</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  {simulationActive && simulationResult.attraction_demand_shift < -40
                    ? `Outdoor demand down by ${simulationResult.attraction_demand_shift}%. Swapping to sheltered museums and heritage centers recommended.`
                    : 'Clear visibility and low precipitation provide optimal conditions for viewpoints, monasteries, and outdoor walks.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                  <span>Dining & Cafe Demand</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  {simulationActive && simulationResult.dining_indoor_surge > 50
                    ? `Outdoor seating closed. Indoor cafe demand surged by +${simulationResult.dining_indoor_surge}% with 30m table wait times.`
                    : 'Open-air dining active. Indoor surge buffer at baseline (+0% rainfall redirection).'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 shadow-2xs space-y-1">
                <Hotel className="w-4 h-4 text-purple-400" />
                <span>Hospitality & Stays</span>
                <p className="text-[11px] text-slate-300 leading-tight">
                  {simulationActive && simParams.temperature_c < 2
                    ? `Radiant underfloor heating and oxygen concentrators operating at peak capacity (+${simulationResult.hotel_capacity_strain}% load).`
                    : `Standard check-in velocity. Heating amenities ready for night lows of ${weatherReport.current.temp_min}°C.`}
                </p>
              </div>
            </div>

            {/* Recommendations */}
            <div className="pt-2 border-t border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {simulationActive ? 'Simulated Digital Twin Actions:' : 'Automated Digital Twin Actions:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5 text-xs text-slate-200">
                {(simulationActive ? simulationResult.recommended_twin_actions : weatherReport.impact_assessment.recommended_actions).map((rec, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
      )}

      {/* ── 5-DAY DETAILED METEOROLOGICAL FORECAST ── */}
      {weatherReport?.forecast && weatherReport.forecast.length > 0 && (
        <div className="p-7 rounded-[2rem] bg-white border border-slate-200/80 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                5-Day Synchronized Weather Forecast
              </h2>
              <p className="text-xs text-slate-500">
                Synchronized with trip days & itinerary activities
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">OpenWeather Multi-Day Model</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 pt-2">
            {weatherReport.forecast.slice(0, 5).map((f) => (
              <div
                key={f.date}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-indigo-300 hover:bg-white transition-all shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{f.day_name}</span>
                  <span className="text-[11px] font-medium text-slate-400">{formatDayDate(f.date)}</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    {f.condition.toLowerCase().includes('rain') ? (
                      <CloudRain className="w-6 h-6 text-blue-500" />
                    ) : f.condition === 'Clear' ? (
                      <Sun className="w-6 h-6 text-amber-500" />
                    ) : (
                      <Cloud className="w-6 h-6 text-slate-400" />
                    )}
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{f.condition}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{f.description}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900">{f.temp_max}°</span>
                    <span className="text-xs text-slate-400 block">{f.temp_min}°</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                  <span className="flex items-center gap-1 font-semibold text-sky-700">
                    <Droplets className="w-3 h-3 text-sky-500" />
                    {Math.round(f.pop * 100)}% rain
                  </span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <Wind className="w-3 h-3 text-slate-400" />
                    {f.wind_speed} km/h
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>
  );
}
