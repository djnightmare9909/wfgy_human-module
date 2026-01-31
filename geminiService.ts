
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Simulation, Scar, Attachment } from "./types";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { processSubconscious } from "./logic";

export const getSimulationResponse = async (
  prompt: string,
  history: ChatMessage[],
  simulation: Simulation,
  scars: Scar[],
  newAttachments: Attachment[] = []
) => {
  const subconscious = processSubconscious(prompt, simulation, scars);
  
  // BBCR: Rebirth mechanism - if collapsed, we start fresh in the current cycle
  const activeHistory = subconscious.shouldCollapse ? [] : history;

  const contents = activeHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [
      ...(msg.attachments || []).map(a => ({
        inlineData: { mimeType: a.mimeType, data: a.data }
      })),
      { text: msg.content }
    ]
  }));

  // Dual-Persona Protocol Injection: The promptHeader acts as the Chronicler's internal world-state report
  const currentPrompt = `${subconscious.promptHeader}\n[CHRONICLER_UPDATE: Calculated Ripple Effects and Semantic Drift processed.]\nUSER_STIMULUS: ${prompt}`;
  
  const fullSystemInstruction = `${SYSTEM_PROMPT}

---
[SECTION_3: DUAL-PERSONA INTERACTION LOOP]
1. Receive USER_STIMULUS.
2. Silently consult The Chronicler (Subconscious state provided in prompt header).
3. Update internal World Turn based on Tension and Pain.
4. Integrate the Chronicler's ripple effects into your narrative persona.
5. Narration must reflect the Repulsive Potential of Scars.

[SIMULATION_PARAMETERS]
IDENTITY_SCAFFOLD: ${simulation.customInstructions || "NONE"}
CYCLE_ID: ${simulation.id}`;

  const userParts = [
    ...newAttachments.map(a => ({
      inlineData: { mimeType: a.mimeType, data: a.data }
    })),
    { text: currentPrompt }
  ];

  try {
    // Correct: Creating a new GoogleGenAI instance right before the call to ensure the latest API key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [...contents as any, { role: 'user', parts: userParts }],
      config: {
        systemInstruction: fullSystemInstruction,
        temperature: subconscious.state.status === 'CRITICAL' ? 1.4 : (subconscious.state.status === 'PAIN' ? 1.1 : 0.8),
        topP: 0.95,
        topK: 64
      }
    });

    // Correct: Accessing text property directly
    const text = response.text || "Neural silence detected.";

    return {
      text,
      state: subconscious.state,
      collapsed: subconscious.shouldCollapse
    };
  } catch (err: any) {
    console.error("Neural Bridge Failure:", err);
    throw new Error("Conscious Layer Disconnect: " + (err instanceof Error ? err.message : String(err)));
  }
};