
import { NeuralState, Simulation, Scar, NeuralStateName } from './types.ts';
import { stringToVector, calculateScarPotential, calculateTension } from './math.ts';

const PAIN_THRESHOLD = 5.0;
const CRITICAL_THRESHOLD = 0.75;
const COLLAPSE_LIMIT = 15.0;

export interface WFGYResult {
  state: NeuralState;
  promptHeader: string;
  shouldCollapse: boolean;
}

export function processSubconscious(
  input: string,
  simulation: Simulation,
  scars: Scar[]
): WFGYResult {
  const currentVec = stringToVector(input);
  const pain = calculateScarPotential(currentVec, scars);
  const tension = calculateTension(currentVec, simulation.identityVector);
  
  // BBMC Residue Formula (simplified for magnitude)
  // B = (ContextMass * Delta S) + Gradient(Psi_scar) -> represented here as raw sum
  const residue = (1.0 * tension) + (pain / 10);

  let status: NeuralStateName = 'RELAXED';
  if (tension > CRITICAL_THRESHOLD) status = 'CRITICAL';
  else if (pain > PAIN_THRESHOLD) status = 'PAIN';
  else if (tension > 0.4) status = 'ALERT';

  const shouldCollapse = residue > COLLAPSE_LIMIT;

  const state: NeuralState = {
    pain,
    tension,
    status
  };

  const promptHeader = `[STATE: Tension=${Math.round(tension * 100)}%, Pain=${Math.round(pain * 10)}%]`;

  return { state, promptHeader, shouldCollapse };
}
