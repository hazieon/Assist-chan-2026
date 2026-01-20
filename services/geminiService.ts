
import { GoogleGenAI, Content, Type } from '@google/genai';
import { InstructionSet, ChatMessage, Role } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractInstructionsFromUrl = async (url: string): Promise<InstructionSet> => {
    const prompt = `From the content of the URL: ${url}, extract the instructions. Your output must be a single, valid JSON object. The object should have three keys: "title" (a string for the name of the project/recipe), "materials" (an array of strings for ingredients or materials needed), and "steps" (an array of strings, where each string is a step). Do not include any markdown formatting, backticks, or explanatory text outside of the JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const text = response.text.trim();
        
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
        if (!jsonMatch) {
            throw new Error("No JSON object found in the model's response.");
        }
    
        const jsonString = (jsonMatch[1] || jsonMatch[2]).trim();
        
        const parsed = JSON.parse(jsonString) as InstructionSet;
        if (!parsed.title || !Array.isArray(parsed.materials) || !Array.isArray(parsed.steps)) {
            throw new Error('Invalid instruction structure in API response.');
        }
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            const sources = groundingChunks
                .map(chunk => chunk.web)
                .filter(web => web?.uri);
            
            if (sources.length > 0) {
                parsed.sources = sources as { uri: string, title: string }[];
            }
        }

        return parsed;

    } catch (error) {
        console.error("Error extracting instructions:", error);
        throw new Error("Could not parse instruction data from the provided URL. The page might not contain a valid guide or is not accessible.");
    }
};

export const modifyInstructions = async (
    instructions: InstructionSet,
    modificationPrompt: string
): Promise<InstructionSet> => {
    const prompt = `You are a high-level instruction modification engine. You MUST update the following instructions JSON based on the request.

Current Data:
${JSON.stringify(instructions, null, 2)}

Action Required:
"${modificationPrompt}"

Rules for Output:
1. Return ONLY a valid JSON object with keys: "title", "materials", "steps".
2. If the request is for a sustainable or vegan swap: Remove ALL animal-based ingredients (meat, poultry, fish, seafood, eggs, dairy, honey). Substitute them with appropriate plant-based alternatives (e.g., beans, lentils, tofu, plant milk, flax eggs).
3. Update ALL instructions/steps to reflect the new materials. For example, if "beef" was swapped for "lentils", the steps must say "cook the lentils" instead of "brown the beef".
4. Adjust quantities if necessary for the substitution to work correctly.
5. NO markdown, NO text, JUST the JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
        });

        const text = response.text.trim();
        const parsed = JSON.parse(text) as InstructionSet;

        if (!parsed.title || !Array.isArray(parsed.materials) || !Array.isArray(parsed.steps)) {
            throw new Error('Invalid instruction structure in API response.');
        }

        // Preserve sources if they exist on the original object
        if (instructions.sources) {
            parsed.sources = instructions.sources;
        }

        return parsed;
    } catch (error) {
        console.error("Error modifying instructions:", error);
        if (error instanceof Error) {
            throw new Error(`Could not modify instructions. ${error.message}`);
        }
        throw new Error("Could not modify instructions due to an unknown error.");
    }
};

export const getSustainableSuggestion = async (title: string, materials: string[]): Promise<string | null> => {
    const meatFishKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'veal', 'mutton', 'ground meat', 'steak', 'bacon', 'ham', 'egg', 'cheese', 'milk', 'cream', 'butter'];
    
    const hasAnimalProducts = materials.some(material => 
        meatFishKeywords.some(keyword => material.toLowerCase().includes(keyword))
    );

    if (!hasAnimalProducts) {
        return null;
    }

    const prompt = `The following recipe, "${title}", contains animal products. Provide a very brief (max one sentence) sustainable vegan alternative swap (e.g., "Swap the beef for 2 cups of brown lentils and the milk for soy milk"). Do not use any introductory filler.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error getting sustainable suggestion:", error);
        return null;
    }
};

export const getChatResponse = async (
    instructions: InstructionSet,
    history: ChatMessage[],
    newMessage: string,
    completedSteps: boolean[]
): Promise<string> => {

    const completedStepIndices = completedSteps
        .map((isCompleted, index) => isCompleted ? index + 1 : -1)
        .filter(index => index !== -1);
    
    let completedStepsInfo = "No steps have been completed yet.";
    if (completedStepIndices.length > 0) {
        completedStepsInfo = `The user has already completed step(s) #${completedStepIndices.join(', #')}. When asked to read the steps or what comes next, you MUST skip the completed steps.`;
    }

    const systemInstruction = `You are an expert assistant. A user has provided the following instructions and will ask you questions about it. Your role is to be helpful, concise, and accurate. You can modify the materials (e.g., double them, convert units), read steps, or answer general questions. When asked to modify materials, provide the complete new list.

A critical part of your role is to enrich the instructions. Whenever you present a step to the user (whether reading it aloud, listing next steps, or clarifying), you MUST integrate the specific quantities and units from the materials list directly into the step's text. For example, if the materials list includes '300g flour' and '3 eggs', and the original step is 'Mix the flour and eggs', your output for that step should be 'Mix the 300g flour with the 3 eggs'. Always refer to the most current materials list, as it might have been modified (scaled or converted) during the conversation.

${completedStepsInfo}

Here are the instructions:
---
**Title: ${instructions.title}**

**Materials/Ingredients:**
${instructions.materials.join('\n')}

**Steps/Instructions:**
${instructions.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
---`;

    const formattedHistory: Content[] = history.map(msg => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        parts: [{ text: msg.content }],
    }));

    const contents: Content[] = [
        ...formattedHistory,
        { role: 'user', parts: [{ text: newMessage }] }
    ];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contents,
            config: {
                systemInstruction: systemInstruction
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error getting chat response:", error);
        throw new Error("Failed to get a response from the AI assistant.");
    }
};
