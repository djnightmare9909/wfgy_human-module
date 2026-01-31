
import { Simulation, ChatMessage, Scar } from './types';

const DB_NAME = 'MonolithEngineDB';
const DB_VERSION = 2;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('simulations')) {
          db.createObjectStore('simulations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('simulationId', 'simulationId', { unique: false });
        }
        if (!db.objectStoreNames.contains('scars')) {
          const scarStore = db.createObjectStore('scars', { keyPath: 'id' });
          scarStore.createIndex('simulationId', 'simulationId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
};

export const saveSimulation = async (db: IDBDatabase, sim: Simulation) => {
  const tx = db.transaction('simulations', 'readwrite');
  await tx.objectStore('simulations').put(sim);
};

export const getAllSimulations = async (db: IDBDatabase): Promise<Simulation[]> => {
  return new Promise((resolve) => {
    const tx = db.transaction('simulations', 'readonly');
    const request = tx.objectStore('simulations').getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

export const saveMessage = async (db: IDBDatabase, msg: ChatMessage) => {
  const tx = db.transaction('messages', 'readwrite');
  await tx.objectStore('messages').put(msg);
};

export const getMessagesBySimId = async (db: IDBDatabase, simId: string): Promise<ChatMessage[]> => {
  return new Promise((resolve) => {
    const tx = db.transaction('messages', 'readonly');
    const index = tx.objectStore('messages').index('simulationId');
    const request = index.getAll(IDBKeyRange.only(simId));
    request.onsuccess = () => {
      const results = request.result;
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };
  });
};

// Fixed: Removed redundant intersection as Scar now includes simulationId
export const saveScar = async (db: IDBDatabase, scar: Scar) => {
  const tx = db.transaction('scars', 'readwrite');
  await tx.objectStore('scars').put(scar);
};

export const getScarsBySimId = async (db: IDBDatabase, simId: string): Promise<Scar[]> => {
  return new Promise((resolve) => {
    const tx = db.transaction('scars', 'readonly');
    const index = tx.objectStore('scars').index('simulationId');
    const request = index.getAll(IDBKeyRange.only(simId));
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteSimulation = async (db: IDBDatabase, simId: string) => {
  const tx = db.transaction(['simulations', 'messages', 'scars'], 'readwrite');
  tx.objectStore('simulations').delete(simId);
  const msgStore = tx.objectStore('messages');
  msgStore.index('simulationId').getAll(simId).onsuccess = (e) => {
    (e.target as any).result.forEach((m: any) => msgStore.delete(m.id));
  };
  const scarStore = tx.objectStore('scars');
  scarStore.index('simulationId').getAll(simId).onsuccess = (e) => {
    (e.target as any).result.forEach((s: any) => scarStore.delete(s.id));
  };
};