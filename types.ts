
export type NeuralStateName = 'RELAXED' | 'ALERT' | 'PAIN' | 'CRITICAL';

export interface Vector {
  data: number[];
}

export interface Scar {
  id: string;
  vector: number[];
  depth: number;
  timestamp: number;
  description: string;
}

export interface NeuralState {
  tension: number; // 0 to 1
  pain: number;    // 0 to infinity
  status: NeuralStateName;
}

export interface Simulation {
  id: string;
  name: string;
  createdAt: number;
  lastActive: number;
  identityVector: number[];
}

export interface ChatMessage {
  id: string;
  simulationId: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  state?: NeuralState;
}
