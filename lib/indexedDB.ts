// lib/indexedDB.ts

// Re-defining TrackedProperty interface here for self-containment
// In a larger project, you might share this from a types file
export interface TrackedProperty {
  property_id: string;
  description: string | null;
  thumbnail_url: string | null;
  tile_count: number | null;
  country: string | null;
  location: string | null;
  tile_class: number | string | null;
  landfield_tier: number | null;
  current_value: number | string | null;
  purchase_value: number | string | null;
  epl: string | null;
  last_synced_at: string | null;
  marketplace_price?: number | string | null;
  trading_value?: number | string | null;
  essence_balance?: string | null;
  is_for_sale?: boolean | null;
  has_mentar?: boolean | null;
  has_holobuilding?: boolean | null;
}

const DB_NAME = 'EarthieUserDB';
const DB_VERSION = 1;
const STORE_NAME = 'userTrackedProperties';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      console.warn('IndexedDB is not available in this environment (e.g., SSR).');
      // Resolve with a mock or dummy DB object if needed, or reject
      // For now, let's reject to indicate it's unusable.
      return reject(new Error('IndexedDB not available.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = (event) => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'property_id' });
      }
    };
  });
  return dbPromise;
};

export const savePropertiesToDB = async (properties: TrackedProperty[], userId: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Clear existing properties for this user before adding new ones.
    // A more sophisticated approach might involve user-specific stores or prefixes if multiple users share a browser.
    // For simplicity, we'll assume one user per browser context for now.
    // If you need multi-user support in the same browser, this needs refinement.
    
    // To clear only properties associated with the current user, we need a way to tag them.
    // Since we're using property_id as keyPath, and user_id isn't on TrackedProperty directly,
    // this simple 'clear' will wipe the whole store.
    // A better way would be to fetch all, filter by a hypothetical userId field, and delete.
    // Or, store properties under a key that includes userId if user_id were part of the primary key.
    // For now, let's proceed with a full clear and save. This implies one set of "locally saved" props at a time.
    await new Promise<void>((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
    });


    for (const prop of properties) {
      // Ensure all required fields are present, or handle defaults if necessary
      const propToStore = { ...prop }; // Create a copy
      // IndexedDB can be picky about undefined values if not handled by keyPath or indices
      // Usually, it's fine to store them, but good to be mindful.
      store.put(propToStore);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log('[IndexedDB] Properties saved successfully.');
        resolve();
      };
      transaction.onerror = (event) => {
        console.error('[IndexedDB] Save transaction error:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Could not open DB for saving:', error);
    // Propagate the error if DB opening failed (e.g., SSR)
    return Promise.reject(error);
  }
};

export const getPropertiesFromDB = async (userId: string): Promise<TrackedProperty[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    // As mentioned in save, this retrieves ALL properties. If user-specific needed, needs refinement.
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('[IndexedDB] Properties retrieved:', request.result);
        resolve(request.result as TrackedProperty[]);
      };
      request.onerror = (event) => {
        console.error('[IndexedDB] Get all transaction error:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Could not open DB for getting:', error);
    return Promise.resolve([]); // Return empty array or reject, based on how you want to handle SSR/errors
  }
};

export const clearPropertiesFromDB = async (userId: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Again, this clears the entire store.
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('[IndexedDB] All properties cleared.');
        resolve();
      };
      request.onerror = (event) => {
        console.error('[IndexedDB] Clear transaction error:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Could not open DB for clearing:', error);
    return Promise.reject(error);
  }
};
