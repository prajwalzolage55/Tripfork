import { db } from './firebase';
import { 
  collection, doc, getDoc, getDocs, query, where, orderBy, 
  setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction
} from 'firebase/firestore';
import { appendEvent } from './ledger';
import type { TripCreatedPayload, ParticipantJoinedPayload } from './ledger';
import type { Trip } from './types';

export async function getTrips(userId: string) {
  // To get trips for a user, we first need to query trip_members
  const membersRef = collection(db, 'trip_members');
  const q = query(membersRef, where('user_id', '==', userId));
  const memberDocs = await getDocs(q);
  
  const tripIds = Array.from(new Set(memberDocs.docs.map(d => d.data().trip_id).filter(Boolean)));
  
  if (tripIds.length === 0) return [];

  // Firestore supports max 30 items in 'in' queries
  const tripsRef = collection(db, 'trips');
  const chunks: string[][] = [];
  for (let i = 0; i < tripIds.length; i += 30) {
    chunks.push(tripIds.slice(i, i + 30));
  }

  const trips: Trip[] = [];
  for (const chunk of chunks) {
    const tripQ = query(tripsRef, where('id', 'in', chunk));
    const tripDocs = await getDocs(tripQ);
    trips.push(...tripDocs.docs.map(d => ({ id: d.id, ...d.data() } as Trip)));
  }
  
  return trips.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
}

export async function createTrip(tripData: any, userId: string, displayName: string) {
  const tripRef = doc(collection(db, 'trips'));
  const tripId = tripRef.id;
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const newTrip = {
    id: tripId,
    name: tripData.name,
    destination: tripData.destination || null,
    start_date: tripData.start_date || null,
    end_date: tripData.end_date || null,
    created_by: userId,
    invite_code: inviteCode,
    created_at: new Date().toISOString(),
    event_version: 0,  // Initialize event version counter for ledger
  };

  await setDoc(tripRef, newTrip);

  const memberRef = doc(collection(db, 'trip_members'));
  await setDoc(memberRef, {
    id: memberRef.id,
    trip_id: tripId,
    user_id: userId,
    display_name: displayName,
    joined_at: new Date().toISOString()
  });

  // Emit ledger events: TRIP_CREATED + creator PARTICIPANT_JOINED
  try {
    const tripPayload: TripCreatedPayload = {
      tripName: tripData.name,
      destination: tripData.destination || null,
      startDate: tripData.start_date || null,
      endDate: tripData.end_date || null,
      createdBy: userId,
      inviteCode,
    };
    await appendEvent(tripId, 'TRIP_CREATED', userId, tripPayload);

    const joinPayload: ParticipantJoinedPayload = {
      memberId: memberRef.id,
      userId,
      displayName,
    };
    await appendEvent(tripId, 'PARTICIPANT_JOINED', userId, joinPayload);
  } catch (err) {
    console.warn('Ledger event emission failed (trip create):', err);
  }

  return newTrip;
}

export async function joinTripByCode(code: string, userId: string, displayName: string) {
  const tripsRef = collection(db, 'trips');
  const q = query(tripsRef, where('invite_code', '==', code.toUpperCase()));
  const tripDocs = await getDocs(q);

  if (tripDocs.empty) {
    throw new Error('Invalid invite code');
  }

  const tripId = tripDocs.docs[0].id;

  const membersRef = collection(db, 'trip_members');
  const memberQ = query(membersRef, where('trip_id', '==', tripId), where('user_id', '==', userId));
  const memberDocs = await getDocs(memberQ);

  if (!memberDocs.empty) {
    // Already joined, maybe update name
    const memberId = memberDocs.docs[0].id;
    await updateDoc(doc(db, 'trip_members', memberId), { display_name: displayName });
    return tripId;
  }

  const newMemberRef = doc(collection(db, 'trip_members'));
  await setDoc(newMemberRef, {
    id: newMemberRef.id,
    trip_id: tripId,
    user_id: userId,
    display_name: displayName,
    joined_at: new Date().toISOString()
  });

  // Emit PARTICIPANT_JOINED event to ledger
  try {
    const joinPayload: ParticipantJoinedPayload = {
      memberId: newMemberRef.id,
      userId,
      displayName,
    };
    await appendEvent(tripId, 'PARTICIPANT_JOINED', userId, joinPayload);
  } catch (err) {
    console.warn('Ledger event emission failed (join trip):', err);
  }

  return tripId;
}

const tripMemoryCache = new Map<string, { trip: Trip; cachedAt: number }>();
const TRIP_CACHE_TTL_MS = 30000; // 30 seconds cache for instant tab transitions

export function invalidateTripCache(tripId?: string) {
  if (tripId) {
    tripMemoryCache.delete(tripId);
  } else {
    tripMemoryCache.clear();
  }
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  const cached = tripMemoryCache.get(tripId);
  if (cached && Date.now() - cached.cachedAt < TRIP_CACHE_TTL_MS) {
    return cached.trip;
  }
  const tripDoc = await getDoc(doc(db, 'trips', tripId));
  if (!tripDoc.exists()) return null;
  const trip = { id: tripDoc.id, ...tripDoc.data() } as Trip;
  tripMemoryCache.set(tripId, { trip, cachedAt: Date.now() });
  return trip;
}

export async function saveTripPreferences(prefs: any) {
  const prefRef = doc(collection(db, 'trip_preferences'));
  await setDoc(prefRef, {
    id: prefRef.id,
    ...prefs,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return prefRef.id;
}

export async function getTripConstitution(tripId: string): Promise<any[] | null> {
  try {
    const constDoc = await getDoc(doc(db, 'trips', tripId, 'settings', 'constitution'));
    if (constDoc.exists() && Array.isArray(constDoc.data()?.rules)) {
      return constDoc.data().rules;
    }
  } catch (err) {
    console.warn('Failed to load trip constitution from settings:', err);
  }
  return null;
}

export async function saveTripConstitution(
  tripId: string,
  rules: any[],
  userId: string,
  rationale?: string
): Promise<void> {
  const settingsRef = doc(db, 'trips', tripId, 'settings', 'constitution');
  await setDoc(settingsRef, {
    rules,
    updated_at: new Date().toISOString(),
    updated_by: userId,
    rationale: rationale || 'Group ratified Fairness Constitution',
  });

  // Also append to immutable ledger stream
  try {
    await appendEvent(tripId, 'CONSTITUTION_UPDATED', userId, {
      rules,
      updatedBy: userId,
      reason: rationale || 'Group ratified Fairness Constitution',
      rationale: rationale || 'Group ratified Fairness Constitution',
      activeCount: rules.filter((r: any) => r.isEnabled).length,
    });
  } catch (err) {
    console.warn('Ledger event emission failed (constitution update):', err);
  }
}

