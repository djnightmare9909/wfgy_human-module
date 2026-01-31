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
  const mag2 = Math.sqrt(v2.reduce((sum, v) => sum + v * v, 0));
  return dot / (mag1 * mag2);
}

/**
 * Calculates Scar Potential Energy (Pain)
 * Psi_scar(x) = sum( Dk / ||x - x_err||^2 )
 */
export function calculateScarPotential(currentVec: number[], scars: Scar[]): number {
  let potential = 0;
  scars.forEach(scar => {
    const distSq = Math.pow(euclideanDistance(currentVec, scar.vector), 2);
    // Avoid division by zero with small epsilon
    potential += scar.depth / (distSq + 0.01);
  });
  return potential;
}

/**
 * Calculates Tension (Stress)
 * Delta S = CosineDistance(Input, Identity)
 */
export function calculateTension(currentVec: number[], identityVec: number[]): number {
  const similarity = cosineSimilarity(currentVec, identityVec);
  return 1 - ((similarity + 1) / 2); // Normalized 0 to 1
}