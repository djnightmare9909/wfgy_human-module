import { Scar } from './types';

/**
 * Deterministic local vectorization for offline-first semantic simulation.
 */
export function stringToVector(str: string): number[] {
  const vec = new Array(128).fill(0);
  const cleanStr = str.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const words = cleanStr.split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    for (let charIdx = 0; charIdx < words[i].length; charIdx++) {
      const code = words[i].charCodeAt(charIdx);
      const pos = (charIdx + (i * 7)) % 128;
      vec[pos] += code;
    }
  }
  
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

export function euclideanDistance(v1: number[], v2: number[]): number {
  return Math.sqrt(v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0));
}

export function cosineSimilarity(v1: number[], v2: number[]): number {
  const dot = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const mag1 = Math.sqrt(v1.reduce((sum, v) => sum + v * v, 0));
  const mag2 = Math.sqrt(v2.reduce((sum