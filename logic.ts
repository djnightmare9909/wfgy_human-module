import { NeuralState, Simulation, Scar, NeuralStateName } from './types';
import { stringToVector, calculateScarPotential, calculateTension } from './math';

const PAIN_THRESHOLD = 5.0;
const CRITICAL_THRESHOLD = 0.75;
const COLLAPSE_LIMIT = 20.0; // Increased for deeper stability before BBCR triggers

export interface WFGYResult {
  state: NeuralState;
  promptHeader: string;
  shouldCollapse: boolean;
}

/**
 * The Subconscious Engine (The Chronicler)
 * Executes the BBMC/BBCR loop before conscious generation.
 */
export function processSubconscious(
  input: string,
  simulation: Simulation,
  scars: Scar[]
): WFGYResult {
  const currentVec = stringToVector(input);
  
  // Calculate Repulsive Potential Energy (Algorithmic Pain)
  const pain = calculateScarPotential(currentVec, scars);
  
  // Calculate Semantic Tension (Delta S)
  const tension = calculateTension(currentVec, simulation.identityVector);
  
  // Semantic Residue calculation (B)
  // Drift = Tension + (Pain / Scalar)
  const residue = (2.0 * tension) + (pain / 5.0);

  let status: NeuralStateName = 'RELAXED';
  if (tension > CRITICAL_THRESHOLD) status = 'CRITICAL';
  else if (pain > PAIN_THRESHOLD) status = 'PAIN';
  else if (tension > 0.4) status = 'ALERT';

  // BBCR Trigger: If semantic drift exceeds stability threshold, collapse the session history
  const shouldCollapse = residue > COLLAPSE_LIMIT;

  const state: NeuralState = {
    pain,
    tension,
    status
  };

  // The Chronicler's internal report injected into the prompt
  const promptHeader = `[STATE: Tension=${Math.round(tension * 100)}%, Pain=${Math.round(pain * 10) / 10}, NeuralStatus=${status}]`;

  return { state, promptHeader, shouldCollapse };
}