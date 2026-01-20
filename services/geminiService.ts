
import { GoogleGenAI, Content } from '@google/genai';
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
    const prompt = `You are an instruction modification assistant. The user wants to modify the following set of instructions.

Current Instructions JSON:
${JSON.stringify(instructions, null, 2)}

Modification Request:
"${modificationPrompt}"

Your task is to apply the modification and return the *entire, updated* set of instructions as a single, valid JSON object. The JSON object must have the keys "title", "materials", and "steps". Do not include any markdown formatting, backticks, or explanatory text outside of the JSON object.

Important Conversion Rules:
- When converting to metric, use appropriate units like grams (g) or kilograms (kg) for solids and milliliters (ml) or liters (L) for liquids. Be intelligent about the conversion. For example, don't convert "1 egg" to grams unless specified.
- When converting to US Imperial, use appropriate units like cups, tablespoons, teaspoons for volume, and ounces (oz) or pounds (lb) for weight.
- When scaling (e.g., doubling), apply the scaling to all relevant quantities in both the "materials" list and the "steps" text.
- Ensure the "title", "materials", and "steps" keys are present in your JSON output.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
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
    const meatFishKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'veal', 'mutton'];
    
    const hasMeatOrFish = materials.some(material => 
        meatFishKeywords.some(keyword => material.toLowerCase().includes(keyword))
    );

    if (!hasMeatOrFish) {
        return null;
    }

    const prompt = `The following recipe, "${title}", contains meat or fish. Provide a very brief (max one sentence) sustainable plant-based alternative. Do not use any introductory filler.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return `**Sustainability Suggestion:** ${response.text.trim()}`;
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
