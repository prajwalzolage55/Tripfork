'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { ItineraryItem } from '@/lib/types';
import { geocodeLocation, KNOWN_COORDINATES } from '@/lib/geocoding';
import { OPENWEATHER_API_KEY, type LiveWeatherReport } from '@/lib/weather';
import { loadCesium } from '@/lib/cesium-loader';
import {
  Navigation,
  Maximize2,
  Minimize2,
  Plus,
  MapPin,
  Layers,
  Globe,
  Map as MapIcon,
  Sparkles,
  CloudRain,
  Cloud,
  Thermometer,
  Wind,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Sliders,
  Radio,
  ChevronDown,
  Info,
  Clock,
  Car,
  MessageSquare,
  Compass,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  X,
  Eye,
  Crosshair,
} from 'lucide-react';
import type { SocialSignal } from '@/lib/social-signals';

export type MapLayerType = 'hybrid' | 'satellite' | 'street';
export type WeatherOverlayType = 'none' | 'precipitation' | 'clouds' | 'temp' | 'wind';

interface ItineraryMapProps {
  items: ItineraryItem[];
  highlightedItemId?: string | null;
  onMarkerClick?: (itemId: string) => void;
  dayTitle?: string;
  destination?: string | null;
  onAddLocationClick?: () => void;
  onMapClick?: (lat: number, lng: number) => void;
  weatherReport?: LiveWeatherReport | null;
  initialDigitalTwinMode?: boolean;
  initialWeatherLayer?: WeatherOverlayType;
  showPropagationControls?: boolean;
  socialSignals?: SocialSignal[];
}

const CATEGORY_COLORS: Record<string, string> = {
  activity: '#4f46e5',
  dining: '#f59e0b',
  hotel: '#8b5cf6',
  transfer: '#0d9488',
  flight: '#0284c7',
  other: '#64748b',
};

const WEATHER_OVERLAYS: Record<
  WeatherOverlayType,
  { name: string; icon: any; layerName: string; badge: string; color: string }
> = {
  none: {
    name: 'Radar Off',
    icon: Layers,
    layerName: '',
    badge: 'Standard 3D',
    color: '#64748b',
  },
  precipitation: {
    name: 'Rain Radar',
    icon: CloudRain,
    layerName: 'precipitation_new',
    badge: 'Live Precipitation',
    color: '#38bdf8',
  },
  clouds: {
    name: 'Cloud Density',
    icon: Cloud,
    layerName: 'clouds_new',
    badge: 'Atmospheric Clouds',
    color: '#94a3b8',
  },
  temp: {
    name: 'Temp Heatmap',
    icon: Thermometer,
    layerName: 'temp_new',
    badge: 'Thermal Gradient',
    color: '#f97316',
  },
  wind: {
    name: 'Wind Stream',
    icon: Wind,
    layerName: 'wind_new',
    badge: 'Atmospheric Vectors',
    color: '#10b981',
  },
};

// Haversine distance in kilometers
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate high-resolution 2D canvas marker for Cesium 3D Billboards
function generatePinDataUrl(
  index: number,
  color: string,
  isSelected: boolean,
  isImpacted: boolean,
  haloColor?: string
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const size = isSelected ? 80 : 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const center = size / 2;

  // 1. Pulsing Halo if impacted or selected
  if (isImpacted || isSelected) {
    ctx.beginPath();
    ctx.arc(center, center, center - 4, 0, Math.PI * 2);
    ctx.fillStyle = haloColor || (isImpacted ? 'rgba(239, 68, 68, 0.45)' : 'rgba(99, 102, 241, 0.45)');
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center, center, center - 6, 0, Math.PI * 2);
    ctx.strokeStyle = isImpacted ? '#ef4444' : '#6366f1';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 2. Main Circle Pin Background
  const pinRadius = isSelected ? 22 : 18;
  ctx.beginPath();
  ctx.arc(center, center, pinRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // 3. Crisp White Border
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // 4. Pin Number Label
  ctx.font = `bold ${isSelected ? 16 : 13}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index), center, center + 0.5);

  return canvas.toDataURL();
}

// Epicenter Icon generator for Digital Twin Center
function generateEpicenterDataUrl(): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Outer radar ring
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.fill();

  // Core red badge
  ctx.beginPath();
  ctx.arc(32, 32, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Target crosshair lines
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 22);
  ctx.lineTo(32, 42);
  ctx.moveTo(22, 32);
  ctx.lineTo(42, 32);
  ctx.stroke();

  return canvas.toDataURL();
}

export default function ItineraryMap({
  items,
  highlightedItemId,
  onMarkerClick,
  dayTitle,
  destination,
  onAddLocationClick,
  onMapClick,
  weatherReport,
  initialDigitalTwinMode = true,
  initialWeatherLayer = 'precipitation',
  showPropagationControls = true,
  socialSignals = [],
}: ItineraryMapProps) {
  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<any>(null);
  const baseImageryLayerRef = useRef<any>(null);
  const weatherImageryLayerRef = useRef<any>(null);
  const itemEntitiesRef = useRef<Map<string, any>>(new Map());
  const polylineEntityRef = useRef<any>(null);
  const epicenterEntityRef = useRef<any>(null);
  const propagationCylinderRef = useRef<any>(null);
  const socialEntitiesRef = useRef<any[]>([]);

  const [cesiumLoaded, setCesiumLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeBaseLayer, setActiveBaseLayer] = useState<MapLayerType>('hybrid');
  const [activeWeatherOverlay, setActiveWeatherOverlay] = useState<WeatherOverlayType>(initialWeatherLayer);
  const [digitalTwinMode, setDigitalTwinMode] = useState<boolean>(initialDigitalTwinMode);
  const [propagationRadiusKm, setPropagationRadiusKm] = useState<number>(20);
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [is3DTilted, setIs3DTilted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedItemState, setSelectedItemState] = useState<ItineraryItem | null>(null);

  // Compute resolved center [lat, lon]
  const resolvedCenter = useMemo<[number, number]>(() => {
    if (weatherReport?.current?.coord) {
      return [weatherReport.current.coord.lat, weatherReport.current.coord.lon];
    }
    if (destination) {
      const clean = destination.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (KNOWN_COORDINATES[clean]) return KNOWN_COORDINATES[clean];
      for (const [k, v] of Object.entries(KNOWN_COORDINATES)) {
        if (clean.includes(k) || k.includes(clean)) return v;
      }
    }
    return [15.2993, 74.1240]; // Default Goa center
  }, [weatherReport?.current?.coord, destination]);

  // Valid itinerary items with coordinates
  const geoItems = useMemo(
    () =>
      items.filter(
        item =>
          item.location &&
          typeof item.location.latitude === 'number' &&
          typeof item.location.longitude === 'number' &&
          !isNaN(item.location.latitude) &&
          !isNaN(item.location.longitude)
      ),
    [items]
  );

  // Epicenter coordinates
  const epicenterCoords = useMemo<[number, number]>(() => {
    if (weatherReport?.current?.coord) {
      return [weatherReport.current.coord.lat, weatherReport.current.coord.lon];
    }
    if (geoItems.length > 0 && geoItems[0].location?.latitude && geoItems[0].location?.longitude) {
      return [geoItems[0].location.latitude, geoItems[0].location.longitude];
    }
    return resolvedCenter;
  }, [weatherReport?.current?.coord, geoItems, resolvedCenter]);

  // Digital Twin Entity Vulnerability Calculator
  const entityVulnerabilityMap = useMemo(() => {
    const map = new Map<
      string,
      {
        level: 'optimal' | 'moderate' | 'high' | 'severe';
        color: string;
        haloColor: string;
        badge: string;
        delayMin: number;
        distanceKm: number;
        inPropagationZone: boolean;
        operationalStatus: string;
        mitigation: string;
        rippleEffect: string;
      }
    >();

    const rainMm = weatherReport?.current?.rain_1h || 0;
    const windSpeed = weatherReport?.current?.wind_speed || 8;
    const cond = (weatherReport?.current?.condition || 'Clear').toLowerCase();
    const isStormy = cond.includes('rain') || cond.includes('snow') || cond.includes('storm') || rainMm > 1;

    geoItems.forEach(item => {
      const lat = item.location!.latitude!;
      const lng = item.location!.longitude!;
      const distanceKm = getDistanceFromLatLonInKm(epicenterCoords[0], epicenterCoords[1], lat, lng);
      const inPropagationZone = distanceKm <= propagationRadiusKm;
      const inSecondaryZone = distanceKm <= propagationRadiusKm * 1.5;

      let level: 'optimal' | 'moderate' | 'high' | 'severe' = 'optimal';
      let delayMin = 0;
      let operationalStatus = 'Optimal Operational Conditions';
      let mitigation = 'No operational changes required. Proceed with planned schedule.';
      let rippleEffect = 'On-time milestone delivery. Zero downstream cascade.';

      if (item.type === 'activity') {
        if (inPropagationZone && isStormy) {
          level = 'severe';
          delayMin = 45;
          operationalStatus = 'Severe Weather Alert - High Outdoor Exposure';
          mitigation = 'Consider shifting to sheltered indoor venue or reschedule.';
          rippleEffect = `+${delayMin}m transit delay propagates into downstream schedule.`;
        } else if (inPropagationZone || (inSecondaryZone && windSpeed > 20)) {
          level = 'moderate';
          delayMin = 20;
          operationalStatus = 'Weather Advisory - High Wind Buffers';
          mitigation = 'Allocate additional 20 minutes buffer for access and gear check.';
          rippleEffect = `+${delayMin}m delay absorbed by flexible schedule.`;
        } else {
          level = 'optimal';
          operationalStatus = 'Ideal Sightseeing Climate';
          mitigation = 'Take advantage of clear visibility for photography.';
          rippleEffect = 'Zero downstream delay.';
        }
      } else if (item.type === 'transfer' || item.type === 'flight') {
        if (inPropagationZone) {
          level = isStormy ? 'severe' : 'moderate';
          delayMin = isStormy ? 40 : 20;
          operationalStatus = isStormy
            ? 'Transit Corridor Reduced Velocity'
            : 'Transit Corridor Moderate Wet Weather Buffer';
          mitigation = 'Deploy four-wheel drive or allocate extra corridor transit buffer.';
          rippleEffect = `+${delayMin}m travel propagation automatically adjusts arrival milestone.`;
        } else {
          level = 'optimal';
          operationalStatus = 'Road Corridor Clear & Fully Passable';
          mitigation = 'Direct route confirmed clear.';
          rippleEffect = 'Zero downstream impact.';
        }
      } else if (item.type === 'dining') {
        if (inPropagationZone && isStormy) {
          level = 'moderate';
          delayMin = 15;
          operationalStatus = 'Outdoor Seating Suspended - Indoor Surge';
          mitigation = 'Reserve indoor table in advance to avoid traveler storm redirection queue.';
          rippleEffect = 'May require 15m dining queue buffer.';
        } else {
          level = 'optimal';
          operationalStatus = 'Standard Cafe & Dining Operations';
          mitigation = 'Outdoor patio and terrace dining open.';
          rippleEffect = 'Normal dining turnaround.';
        }
      } else {
        level = 'optimal';
        operationalStatus = 'Standard Hospitality Operations';
        mitigation = 'Standard check-in procedure.';
        rippleEffect = 'Seamless arrival.';
      }

      let color = '#10b981';
      let haloColor = 'rgba(16, 185, 129, 0.4)';
      let badge = 'Safe';

      if (level === 'severe') {
        color = '#ef4444';
        haloColor = 'rgba(239, 68, 68, 0.6)';
        badge = `Alert +${delayMin}m`;
      } else if (level === 'moderate') {
        color = '#f59e0b';
        haloColor = 'rgba(245, 158, 11, 0.5)';
        badge = `Buffer +${delayMin}m`;
      }

      map.set(item.id, {
        level,
        color,
        haloColor,
        badge,
        delayMin,
        distanceKm,
        inPropagationZone,
        operationalStatus,
        mitigation,
        rippleEffect,
      });
    });

    return map;
  }, [geoItems, weatherReport, epicenterCoords, propagationRadiusKm]);

  // Count of impacted stops
  const impactedCount = useMemo(() => {
    let count = 0;
    entityVulnerabilityMap.forEach(v => {
      if (v.level === 'severe' || v.level === 'moderate') count++;
    });
    return count;
  }, [entityVulnerabilityMap]);

  // Helper to get Imagery Provider for Base Layers
  const createBaseImageryProvider = useCallback((type: MapLayerType, Cesium: any) => {
    if (type === 'satellite') {
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        subdomains: ['0', '1', '2', '3'],
        maximumLevel: 20,
      });
    } else if (type === 'street') {
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        subdomains: ['0', '1', '2', '3'],
        maximumLevel: 20,
      });
    } else {
      // Hybrid (Satellite + Labels)
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        subdomains: ['0', '1', '2', '3'],
        maximumLevel: 20,
      });
    }
  }, []);

  // 1. Initialize Cesium 3D Globe Map
  useEffect(() => {
    let isMounted = true;

    async function initCesiumGlobe() {
      if (!containerRef.current || viewerRef.current) return;

      try {
        const Cesium = await loadCesium();
        if (!isMounted || !containerRef.current) return;
        cesiumRef.current = Cesium;

        // Determine initial focus location (trip destination or first item coords)
        const initialLat = geoItems[0]?.location?.latitude ?? resolvedCenter[0];
        const initialLon = geoItems[0]?.location?.longitude ?? resolvedCenter[1];

        // Instantiate Cesium Viewer with CLEAN config: ZERO overlapping widgets!
        const viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,              // Prevents default iframe popup from overlapping UI
          selectionIndicator: false,   // Prevents default green selection square
          vrButton: false,
          scene3DOnly: true,
          requestRenderMode: false,
          maximumRenderTimeChange: Infinity,
          contextOptions: {
            webgl: {
              alpha: false,
              depth: true,
              stencil: false,
              antialias: true,
              powerPreference: 'high-performance',
            },
          },
        });

        viewerRef.current = viewer;

        // Prevent wheel & touch from bubbling up to Lenis and scrolling the webpage
        if (viewer.scene?.canvas) {
          const canvas = viewer.scene.canvas;
          canvas.setAttribute('data-lenis-prevent', '');
          canvas.setAttribute('data-lenis-prevent-wheel', '');
          canvas.setAttribute('data-lenis-prevent-touch', '');
          canvas.style.touchAction = 'none';
        }

        // Crisp High-DPI rendering
        viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);

        // --- REQUIREMENT: "there is limit only earth will display" ---
        // 1. Remove outer starry universe / skybox so only Earth is shown
        if (viewer.scene.skyBox) {
          viewer.scene.skyBox.destroy();
          (viewer.scene as any).skyBox = undefined;
        }
        // Deep obsidian cosmic background
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0B0F19');
        viewer.scene.sun.show = false;
        viewer.scene.moon.show = false;
        viewer.scene.globe.show = true;
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#111827');
        viewer.scene.skyAtmosphere.show = true; // Sleek atmospheric halo around Earth

        // 2. Camera boundaries: Enforce that only Earth will display and cannot vanish into void or clip through ground
        const controller = viewer.scene.screenSpaceCameraController;
        controller.enableCollisionDetection = true;
        controller.minimumZoomDistance = 300;       // Max zoom in: 300 meters above ground
        controller.maximumZoomDistance = 16000000;  // Max zoom out: 16,000 km, keeping Earth bounded in view
        controller.inertiaSpin = 0.85;
        controller.inertiaTranslate = 0.85;
        controller.inertiaZoom = 0.85;

        // Apply Base Layer
        viewer.imageryLayers.removeAll();
        const baseProvider = createBaseImageryProvider(activeBaseLayer, Cesium);
        baseImageryLayerRef.current = viewer.imageryLayers.addImageryProvider(baseProvider);

        // Apply Weather Radar Overlay if active
        if (activeWeatherOverlay !== 'none') {
          const config = WEATHER_OVERLAYS[activeWeatherOverlay];
          if (config.layerName) {
            const wProvider = new Cesium.UrlTemplateImageryProvider({
              url: `https://tile.openweathermap.org/map/${config.layerName}/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
              maximumLevel: 18,
            });
            const wLayer = viewer.imageryLayers.addImageryProvider(wProvider);
            wLayer.alpha = 0.72;
            weatherImageryLayerRef.current = wLayer;
          }
        }

        // --- REQUIREMENT: "as trip location changes it show that location first" ---
        // Instantly position camera at target trip destination so it appears immediately!
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(initialLon, initialLat, 32000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45), // Cinematic 45° angled 3D globe view
            roll: 0.0,
          },
        });

        // Click Handler for entity selection and custom pin placement
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: any) => {
          const pickedObject = viewer.scene.pick(click.position);

          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entity = pickedObject.id;
            if (entity._itineraryItem) {
              const item = entity._itineraryItem as ItineraryItem;
              setSelectedItemState(item);
              if (onMarkerClick) onMarkerClick(item.id);

              // Smooth fly-to selected entity
              if (item.location?.latitude && item.location?.longitude) {
                viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(
                    item.location.longitude,
                    item.location.latitude,
                    6000
                  ),
                  orientation: {
                    heading: viewer.camera.heading,
                    pitch: Cesium.Math.toRadians(-35),
                    roll: 0.0,
                  },
                  duration: 1.2,
                });
              }
              return;
            }
          }

          // If clicked on globe surface
          const ray = viewer.camera.getPickRay(click.position);
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
          if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const lng = Cesium.Math.toDegrees(cartographic.longitude);
            if (onMapClick) onMapClick(lat, lng);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        setCesiumLoaded(true);
      } catch (err: any) {
        console.error('Cesium globe initialization error:', err);
        setLoadError(err?.message || 'Failed to initialize Cesium 3D Globe');
      }
    }

    initCesiumGlobe();

    return () => {
      isMounted = false;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.destroy();
        } catch (e) {
          console.warn('Cesium cleanup warning:', e);
        }
        viewerRef.current = null;
        cesiumRef.current = null;
        baseImageryLayerRef.current = null;
        weatherImageryLayerRef.current = null;
      }
    };
  }, []); // Run once on mount

  // 2. Base Layer Switcher Effect
  useEffect(() => {
    if (!cesiumLoaded || !viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;

    if (baseImageryLayerRef.current) {
      viewer.imageryLayers.remove(baseImageryLayerRef.current, true);
    }

    const provider = createBaseImageryProvider(activeBaseLayer, Cesium);
    const newBase = viewer.imageryLayers.addImageryProvider(provider, 0);
    baseImageryLayerRef.current = newBase;
  }, [activeBaseLayer, cesiumLoaded, createBaseImageryProvider]);

  // 3. Weather Radar Layer Switcher Effect
  useEffect(() => {
    if (!cesiumLoaded || !viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;

    if (weatherImageryLayerRef.current) {
      viewer.imageryLayers.remove(weatherImageryLayerRef.current, true);
      weatherImageryLayerRef.current = null;
    }

    if (activeWeatherOverlay !== 'none') {
      const config = WEATHER_OVERLAYS[activeWeatherOverlay];
      if (config.layerName) {
        const wProvider = new Cesium.UrlTemplateImageryProvider({
          url: `https://tile.openweathermap.org/map/${config.layerName}/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
          maximumLevel: 18,
        });
        const wLayer = viewer.imageryLayers.addImageryProvider(wProvider);
        wLayer.alpha = 0.75;
        weatherImageryLayerRef.current = wLayer;
      }
    }
  }, [activeWeatherOverlay, cesiumLoaded]);

  // 4. Update 3D Itinerary Pins & Glowing Polyline Route
  useEffect(() => {
    if (!cesiumLoaded || !viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;

    // Clear old itinerary entities
    itemEntitiesRef.current.forEach(entity => viewer.entities.remove(entity));
    itemEntitiesRef.current.clear();

    if (polylineEntityRef.current) {
      viewer.entities.remove(polylineEntityRef.current);
      polylineEntityRef.current = null;
    }

    if (geoItems.length === 0) return;

    const positions: any[] = [];

    geoItems.forEach((item, index) => {
      const lat = item.location!.latitude!;
      const lng = item.location!.longitude!;
      const isSelected = highlightedItemId === item.id || selectedItemState?.id === item.id;
      const vuln = entityVulnerabilityMap.get(item.id);
      const isImpacted = digitalTwinMode && (vuln?.level === 'severe' || vuln?.level === 'moderate');
      const catColor = CATEGORY_COLORS[item.type] || '#4f46e5';
      const pinColor = digitalTwinMode ? (vuln?.color || catColor) : catColor;

      const pinIconUrl = generatePinDataUrl(index + 1, pinColor, isSelected, isImpacted, vuln?.haloColor);

      // Create 3D pin entity with billboard and vertical ground dropline
      const entity = viewer.entities.add({
        id: `pin-${item.id}`,
        name: item.label,
        position: Cesium.Cartesian3.fromDegrees(lng, lat, isSelected ? 40 : 15),
        billboard: {
          image: pinIconUrl,
          width: isSelected ? 48 : 38,
          height: isSelected ? 48 : 38,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY, // Always render clearly above terrain
        },
        // Ground marker dropline
        polyline: {
          positions: [
            Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            Cesium.Cartesian3.fromDegrees(lng, lat, isSelected ? 40 : 15),
          ],
          width: 2,
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString(pinColor).withAlpha(0.6)
          ),
        },
      });

      (entity as any)._itineraryItem = item;
      itemEntitiesRef.current.set(item.id, entity);
      positions.push(Cesium.Cartesian3.fromDegrees(lng, lat, 10));
    });

    // 3D Glowing Route Polyline connecting all stops
    if (positions.length > 1) {
      polylineEntityRef.current = viewer.entities.add({
        name: 'Itinerary Route',
        polyline: {
          positions,
          width: 4,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            taperPower: 1.0,
            color: Cesium.Color.fromCssColorString('#6366f1'),
          }),
          clampToGround: true,
        },
      });
    }
  }, [geoItems, highlightedItemId, selectedItemState, entityVulnerabilityMap, digitalTwinMode, cesiumLoaded]);

  // 5. Digital Twin Epicenter & 3D Propagation Radius Layer
  useEffect(() => {
    if (!cesiumLoaded || !viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;

    // Clean existing digital twin entities
    if (epicenterEntityRef.current) {
      viewer.entities.remove(epicenterEntityRef.current);
      epicenterEntityRef.current = null;
    }
    if (propagationCylinderRef.current) {
      viewer.entities.remove(propagationCylinderRef.current);
      propagationCylinderRef.current = null;
    }

    if (!digitalTwinMode) return;

    const [eLat, eLng] = epicenterCoords;
    const radiusMeters = propagationRadiusKm * 1000;

    // 1. 3D Translucent Propagation Radius Dome / Cylinder on Globe
    propagationCylinderRef.current = viewer.entities.add({
      name: 'Weather Front Propagation Perimeter',
      position: Cesium.Cartesian3.fromDegrees(eLng, eLat, 0),
      ellipse: {
        semiMajorAxis: radiusMeters,
        semiMinorAxis: radiusMeters,
        material: Cesium.Color.RED.withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.RED.withAlpha(0.8),
        outlineWidth: 2,
        height: 50,
      },
    });

    // 2. Epicenter 3D Radar Origin Pin
    const epicenterDataUrl = generateEpicenterDataUrl();
    epicenterEntityRef.current = viewer.entities.add({
      name: 'Meteorological Epicenter',
      position: Cesium.Cartesian3.fromDegrees(eLng, eLat, 30),
      billboard: {
        image: epicenterDataUrl,
        width: 44,
        height: 44,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(eLng, eLat, 0),
          Cesium.Cartesian3.fromDegrees(eLng, eLat, 30),
        ],
        width: 2,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.5)),
      },
    });
  }, [digitalTwinMode, epicenterCoords, propagationRadiusKm, cesiumLoaded]);

  // 6. Real-world Social Signals 3D Spatial Nodes
  useEffect(() => {
    if (!cesiumLoaded || !viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;

    // Clean previous social nodes
    socialEntitiesRef.current.forEach(e => viewer.entities.remove(e));
    socialEntitiesRef.current = [];

    if (!socialSignals || socialSignals.length === 0) return;

    socialSignals.forEach(sig => {
      if (!sig.coords?.lat || !sig.coords?.lon) return;

      const hexColor =
        sig.sentiment === 'positive'
          ? '#10b981'
          : sig.sentiment === 'caution'
          ? '#ef4444'
          : '#f59e0b';

      const sigColor = Cesium.Color.fromCssColorString(hexColor);

      const node = viewer.entities.add({
        name: `Social Node: ${sig.platform_name}`,
        position: Cesium.Cartesian3.fromDegrees(sig.coords.lon, sig.coords.lat, 20),
        point: {
          pixelSize: 12,
          color: sigColor ? sigColor.withAlpha(0.9) : Cesium.Color.GREEN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      socialEntitiesRef.current.push(node);
    });
  }, [socialSignals, cesiumLoaded]);

  // 7. REQUIREMENT: "as trip location changes it show that location first"
  // When destination, coordinates, or highlighted item changes, smoothly re-orient camera
  const flyToDestination = useCallback(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;

    let targetLat = resolvedCenter[0];
    let targetLng = resolvedCenter[1];
    let altitude = 32000;

    if (highlightedItemId) {
      const match = geoItems.find(i => i.id === highlightedItemId);
      if (match?.location?.latitude && match?.location?.longitude) {
        targetLat = match.location.latitude;
        targetLng = match.location.longitude;
        altitude = 8000;
      }
    } else if (geoItems.length > 0) {
      targetLat = geoItems[0].location!.latitude!;
      targetLng = geoItems[0].location!.longitude!;
      altitude = geoItems.length > 3 ? 45000 : 25000;
    }

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, altitude),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: is3DTilted ? Cesium.Math.toRadians(-45) : Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
      duration: 1.8,
    });
  }, [resolvedCenter, highlightedItemId, geoItems, is3DTilted]);

  // Trigger flight on destination or items update
  useEffect(() => {
    if (cesiumLoaded) {
      flyToDestination();
    }
  }, [destination, geoItems.length, highlightedItemId, cesiumLoaded, flyToDestination]);

  // Zoom Controls
  const handleZoomIn = () => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.zoomIn(viewerRef.current.camera.positionCartographic.height * 0.4);
  };

  const handleZoomOut = () => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.zoomOut(viewerRef.current.camera.positionCartographic.height * 0.5);
  };

  // 3D Perspective Tilt Toggle
  const toggle3DTilt = () => {
    if (!viewerRef.current || !cesiumRef.current) return;
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    const newTilt = !is3DTilted;
    setIs3DTilted(newTilt);

    const pos = viewer.camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height),
      orientation: {
        heading: viewer.camera.heading,
        pitch: newTilt ? Cesium.Math.toRadians(-45) : Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
      duration: 1.0,
    });
  };

  // Isolate wheel & touch gestures to the 3D globe: completely prevents the webpage from scrolling
  useEffect(() => {
    const rootEl = rootContainerRef.current;
    if (!rootEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Stop event from bubbling up to Lenis or window
      e.stopPropagation();
      // Prevent browser default window scroll
      e.preventDefault();

      // If wheel occurred over HUD overlays / buttons instead of direct canvas, smoothly zoom Cesium camera
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        const canvas = viewerRef.current.scene?.canvas;
        if (canvas && e.target !== canvas) {
          const camera = viewerRef.current.camera;
          const currentHeight = camera.positionCartographic?.height || 25000;
          const zoomAmount = Math.max(currentHeight * 0.16, 400);
          if (e.deltaY < 0) {
            camera.zoomIn(zoomAmount);
          } else if (e.deltaY > 0) {
            camera.zoomOut(zoomAmount);
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent mobile/trackpad gestures on map from dragging the page
      e.stopPropagation();
    };

    rootEl.addEventListener('wheel', handleWheel, { passive: false });
    rootEl.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      rootEl.removeEventListener('wheel', handleWheel);
      rootEl.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <div
      ref={rootContainerRef}
      data-lenis-prevent
      data-lenis-prevent-wheel
      data-lenis-prevent-touch
      className={`relative w-full overflow-hidden rounded-2xl border border-stone-200 shadow-md bg-[#0B0F19] select-none overscroll-contain ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'h-[540px]'
      }`}
      style={{
        touchAction: 'none',
        overscrollBehavior: 'contain',
      }}
    >
      {/* ── CESIUM 3D GLOBE CONTAINER (Zero-Overlap Absolute Base Canvas) ── */}
      <div
        ref={containerRef}
        data-lenis-prevent
        data-lenis-prevent-wheel
        data-lenis-prevent-touch
        className="w-full h-full absolute inset-0 z-0 bg-[#0B0F19] overscroll-contain"
        style={{
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }}
      />

      {/* Loading Overlay */}
      {!cesiumLoaded && !loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0B0F19] text-white gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" />
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <Globe className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto" />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-stone-200 tracking-wide uppercase">
              Rendering Cesium 3D Globe
            </p>
            <p className="text-xs text-slate-400">
              Aligning coordinates for {destination || 'Destination'}...
            </p>
          </div>
        </div>
      )}

      {/* Load Error State */}
      {loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0B0F19]/90 text-white p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
          <p className="text-sm font-bold text-amber-300">Cesium 3D Globe Initialization Notice</p>
          <p className="text-xs text-stone-400 max-w-sm mt-1 mb-4">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Retry WebGL Engine
          </button>
        </div>
      )}

      {/* ── TOP HUD CONTROLS (Z-INDEX 20, ZERO OVERLAPPING) ── */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Destination & 3D Globe Telemetry Badge */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-tight flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                {destination || weatherReport?.destination || 'Global 3D Earth'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {geoItems.length} Stops Plotted • {resolvedCenter[0].toFixed(2)}°N, {resolvedCenter[1].toFixed(2)}°E
              </span>
            </div>
          </div>

          {/* Quick Re-center Button */}
          <button
            onClick={flyToDestination}
            className="p-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg text-slate-200 hover:text-white hover:bg-slate-800 transition"
            title="Re-center camera to trip destination"
          >
            <Crosshair className="w-4 h-4 text-indigo-400" />
          </button>
        </div>

        {/* Right: Layer Switcher & Weather Radar Dropdown */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Layer Selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg">
            {(['hybrid', 'satellite', 'street'] as MapLayerType[]).map(type => (
              <button
                key={type}
                onClick={() => setActiveBaseLayer(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                  activeBaseLayer === type
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* OpenWeather Radar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg text-white hover:bg-slate-800 transition text-xs font-semibold"
            >
              <CloudRain className="w-3.5 h-3.5 text-blue-400" />
              <span>{WEATHER_OVERLAYS[activeWeatherOverlay].name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showLayerMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-1.5 space-y-1 z-30">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                  OpenWeather 3D Radar
                </div>
                {(Object.keys(WEATHER_OVERLAYS) as WeatherOverlayType[]).map(key => {
                  const item = WEATHER_OVERLAYS[key];
                  const Icon = item.icon;
                  const isActive = activeWeatherOverlay === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setActiveWeatherOverlay(key);
                        setShowLayerMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" style={{ color: isActive ? '#ffffff' : item.color }} />
                        <span>{item.name}</span>
                      </div>
                      {isActive && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT BOTTOM 3D CAMERA CONTROLS (Z-INDEX 20) ── */}
      <div className="absolute right-3 bottom-14 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg text-slate-200 hover:text-white hover:bg-slate-800 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg text-slate-200 hover:text-white hover:bg-slate-800 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={toggle3DTilt}
          className={`p-2 rounded-xl backdrop-blur-md border border-slate-700/60 shadow-lg transition ${
            is3DTilted ? 'bg-indigo-600 text-white' : 'bg-slate-900/85 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={is3DTilted ? 'Switch to 2D Top-Down View' : 'Switch to 3D Angled Horizon View'}
        >
          <Compass className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg text-slate-200 hover:text-white hover:bg-slate-800 transition"
          title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* ── BOTTOM HUD: DIGITAL TWIN CONTROLS & SELECTED STOP SHEET ── */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex flex-col md:flex-row items-center justify-between gap-2 pointer-events-none">
        {/* Left: Digital Twin Radius Control */}
        {showPropagationControls && (
          <div className="pointer-events-auto flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg text-white">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold">Digital Twin Perimeter:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={propagationRadiusKm}
                onChange={e => setPropagationRadiusKm(Number(e.target.value))}
                className="w-24 accent-blue-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
              <span className="text-xs font-extrabold text-blue-400 w-10">
                {propagationRadiusKm} km
              </span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <span className="text-xs text-slate-400">
              {impactedCount > 0 ? (
                <span className="text-amber-400 font-bold">{impactedCount} Stops In Radar Perimeter</span>
              ) : (
                <span className="text-emerald-400 font-bold">All Stops Clear</span>
              )}
            </span>
          </div>
        )}

        {/* Selected Item Floating Modal Card */}
        {selectedItemState && (
          <div className="pointer-events-auto w-full md:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-3 text-white space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${CATEGORY_COLORS[selectedItemState.type]}33`,
                    color: CATEGORY_COLORS[selectedItemState.type],
                  }}
                >
                  {selectedItemState.type}
                </span>
                <h4 className="text-sm font-extrabold text-white mt-1">
                  {selectedItemState.label}
                </h4>
              </div>
              <button
                onClick={() => setSelectedItemState(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedItemState.location?.address && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
                <span className="truncate">{selectedItemState.location.address}</span>
              </p>
            )}

            {/* Time & Cost */}
            <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs">
              <div>
                <span className="text-xs text-slate-400 font-semibold block uppercase">Schedule</span>
                <span className="font-bold text-slate-200">
                  {selectedItemState.start_time || 'Flexible'} {selectedItemState.end_time ? `– ${selectedItemState.end_time}` : ''}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold block uppercase">Cost</span>
                <span className="font-bold text-slate-200">
                  {selectedItemState.cost > 0 ? `₹${selectedItemState.cost.toLocaleString('en-IN')}` : 'Free'}
                </span>
              </div>
            </div>

            {/* Digital Twin Vulnerability Diagnostic */}
            {digitalTwinMode && entityVulnerabilityMap.has(selectedItemState.id) && (
              (() => {
                const v = entityVulnerabilityMap.get(selectedItemState.id)!;
                return (
                  <div
                    className="p-2 rounded-xl border text-xs space-y-1"
                    style={{
                      backgroundColor: `${v.color}15`,
                      borderColor: `${v.color}40`,
                    }}
                  >
                    <div className="flex items-center justify-between font-bold" style={{ color: v.color }}>
                      <span>{v.operationalStatus}</span>
                      <span>{v.distanceKm.toFixed(1)} km to Epicenter</span>
                    </div>
                    <p className="text-slate-300 text-xs leading-normal">
                      <strong>Mitigation:</strong> {v.mitigation}
                    </p>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Custom Styles for Cesium container to ensure NO OVERLAPPING */}
      <style jsx global>{`
        .cesium-viewer {
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          position: absolute !important;
          inset: 0 !important;
        }
        .cesium-widget,
        .cesium-widget canvas {
          width: 100% !important;
          height: 100% !important;
          touch-action: none !important;
        }
        .cesium-viewer-bottom,
        .cesium-widget-credits,
        .cesium-credit-logoContainer,
        .cesium-credit-textContainer,
        .cesium-infoBox,
        .cesium-selection-wrapper {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
