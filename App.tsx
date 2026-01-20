
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { InstructionSet, ChatMessage as ChatMessageType, Role } from './types';
import { extractInstructionsFromUrl, getSustainableSuggestion, getChatResponse, modifyInstructions } from './services/geminiService';
import UrlInputForm from './components/UrlInputForm';
import ChatInterface from './components/ChatInterface';
import InstructionDisplay from './components/RecipeDisplay';
import ActionButtons from './components/ActionButtons';
import { BotIcon } from './components/icons/BotIcon';
import { SpeakerIcon } from './components/icons/SpeakerIcon';
import { SpeakerMuteIcon } from './components/icons/SpeakerMuteIcon';
import { MicIcon } from './components/icons/MicIcon';

const App: React.FC = () => {
    const [instructionSet, setInstructionSet] = useState<InstructionSet | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isAnswering, setIsAnswering] = useState<boolean>(false);
    const [isModifying, setIsModifying] = useState<boolean>(false);
    const [isEcoApplied, setIsEcoApplied] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessageType[]>([]);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [completedSteps, setCompletedSteps] = useState<boolean[]>([]);
    const [isContinuousListening, setIsContinuousListening] = useState<boolean>(false);
    const [isReadingInstructions, setIsReadingInstructions] = useState<boolean>(false);
    
    const isMutedRef = useRef(isMuted);
    isMutedRef.current = isMuted;
    const readingUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const handleToggleStep = (index: number) => {
        setCompletedSteps(prev => {
            const newCompleted = [...prev];
            newCompleted[index] = !newCompleted[index];
            return newCompleted;
        });
    };
    
    const speak = useCallback((text: string) => {
        if (isMutedRef.current) return;
        window.speechSynthesis.cancel();
        // Clean text for cleaner TTS
        const cleanText = text.replace(/\*\*/g, '').replace(/#/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        window.speechSynthesis.speak(utterance);
    }, []);

    const handleFetchInstructions = useCallback(async (url: string) => {
        if (!url) {
            setError('Please enter a valid URL.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setInstructionSet(null);
        setChatHistory([]);
        setCompletedSteps([]);
        setIsEcoApplied(false);
        window.speechSynthesis.cancel();
        setIsReadingInstructions(false);

        try {
            const extractedInstructions = await extractInstructionsFromUrl(url);
            
            const suggestion = await getSustainableSuggestion(extractedInstructions.title, extractedInstructions.materials);
            
            if (suggestion) {
                extractedInstructions.sustainabilitySuggestion = suggestion;
            }

            setInstructionSet(extractedInstructions);
            setCompletedSteps(new Array(extractedInstructions.steps.length).fill(false));
            
            const welcomeMessageText = `I have loaded the instructions for **${extractedInstructions.title}**. How can I help? You can ask me to scale it, convert units, or clarify steps.`;
            const welcomeMessage: ChatMessageType = { role: Role.ASSISTANT, content: welcomeMessageText };
            let initialChat: ChatMessageType[] = [welcomeMessage];
            
            if (suggestion) {
                const suggestionMessage: ChatMessageType = { 
                    role: Role.ASSISTANT, 
                    content: `**Sustainability Suggestion:** ${suggestion}` 
                };
                initialChat.push(suggestionMessage);
            }
            
            setChatHistory(initialChat);
            
            // Speak both as a single block to ensure completion and no interruptions
            let speechCombined = welcomeMessageText;
            if (suggestion) {
                speechCombined += `. Here is a suggestion: ${suggestion}. Just click the green eco button to switch the recipe.`;
            }
            speak(speechCombined);

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred while fetching the instructions.';
            setError(`Failed to process instructions. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [speak]);

    const handleModifyInstructions = useCallback(async (prompt: string, isEcoSwitch: boolean = false) => {
        if (!instructionSet) return;

        setIsModifying(true);
        setError(null);

        try {
            const newInstructionSet = await modifyInstructions(instructionSet, prompt);
            
            if (isEcoSwitch) {
                setIsEcoApplied(true);
                // After switching, the previous suggestion is no longer needed
                newInstructionSet.sustainabilitySuggestion = undefined;
            } else if (prompt.toLowerCase().includes("sustainable alternative") || (instructionSet.sustainabilitySuggestion && prompt.includes(instructionSet.sustainabilitySuggestion))) {
                setIsEcoApplied(true);
                newInstructionSet.sustainabilitySuggestion = undefined;
            }

            setInstructionSet(newInstructionSet);
            setCompletedSteps(new Array(newInstructionSet.steps.length).fill(false));

            const confirmationMessage: ChatMessageType = {
                role: Role.ASSISTANT,
                content: `I've fully updated the recipe to be plant-based and sustainable. You can see the new ingredients and steps above.`
            };
            setChatHistory(prev => [...prev, confirmationMessage]);
            speak(confirmationMessage.content);

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred while modifying the instructions.';
            setError(`Failed to modify instructions. ${errorMessage}`);
            const errorResponse: ChatMessageType = { role: Role.ASSISTANT, content: `Sorry, I encountered an error while updating: ${errorMessage}` };
            setChatHistory(prev => [...prev, errorResponse]);
        } finally {
            setIsModifying(false);
        }
    }, [instructionSet, speak]);

    const handleEcoSwitch = useCallback(() => {
        if (isEcoApplied || !instructionSet) return;
        
        // Powerful prompt to ensure full transformation
        const prompt = `REGENERATE THE ENTIRE RECIPE. 
        MANDATORY ACTION: Remove ALL meat, fish, eggs, cheese, milk, butter, and any other animal-based products. 
        REPLACEMENT: Replace every removed item with a high-quality, sustainable plant-based alternative (like beans, lentils, mushrooms, tofu, or nut milks). 
        UPDATE MATERIALS: List every new ingredient with correct measurements.
        UPDATE STEPS: Re-write EVERY instruction step to refer to the new ingredients. If a step previously said "cook the chicken", it must now say "cook the [replacement item]".
        GUIDANCE: ${instructionSet.sustainabilitySuggestion || "Transform this into a vegan version."}`;

        handleModifyInstructions(prompt, true);
    }, [instructionSet, isEcoApplied, handleModifyInstructions]);

    const handleSendMessage = useCallback(async (message: string) => {
        if (!instructionSet || isAnswering) return;

        setIsAnswering(true);
        window.speechSynthesis.cancel();
        setIsReadingInstructions(false);
        const userMessage: ChatMessageType = { role: Role.USER, content: message };
        setChatHistory(prev => [...prev, userMessage]);

        try {
            const aiResponse = await getChatResponse(
                instructionSet,
                chatHistory,
                message,
                completedSteps
            );
            
            const assistantMessage: ChatMessageType = { role: Role.ASSISTANT, content: aiResponse };
            setChatHistory(prev => [...prev, assistantMessage]);
            
            speak(aiResponse);

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            const errorResponse: ChatMessageType = { role: Role.ASSISTANT, content: `Sorry, I encountered an error: ${errorMessage}` };
            setChatHistory(prev => [...prev, errorResponse]);
        } finally {
            setIsAnswering(false);
        }
    }, [instructionSet, isAnswering, speak, chatHistory, completedSteps]);
    
    const handleToggleMute = () => {
        setIsMuted(prev => {
            const newMutedState = !prev;
            if (newMutedState) {
                window.speechSynthesis.cancel();
                setIsReadingInstructions(false);
            }
            return newMutedState;
        });
    };

    const handleReadInstructions = useCallback(() => {
        if (!instructionSet || isMuted) return;

        window.speechSynthesis.cancel();
        
        const textToSpeak = instructionSet.steps
            .filter((_, index) => !completedSteps[index])
            .join('\n\n');

        if (!textToSpeak.trim()) {
            speak("All steps are completed.");
            return;
        }

        const cleanText = textToSpeak.replace(/\*\*/g, '').replace(/#/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        readingUtteranceRef.current = utterance;

        utterance.onstart = () => setIsReadingInstructions(true);
        utterance.onend = () => {
            setIsReadingInstructions(false);
            readingUtteranceRef.current = null;
        };
        utterance.onerror = () => {
            setIsReadingInstructions(false);
            readingUtteranceRef.current = null;
        };

        window.speechSynthesis.speak(utterance);
    }, [instructionSet, completedSteps, isMuted, speak]);

    const handleStopReading = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsReadingInstructions(false);
        readingUtteranceRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);
    
    const isBusy = isLoading || isAnswering || isModifying;

    return (
        <div className="min-h-screen bg-primary text-text-primary font-sans">
            <header className="bg-secondary p-4 shadow-md sticky top-0 z-10">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <BotIcon className="w-8 h-8 text-accent" />
                        <h1 className="text-2xl font-bold">AI Instructions Assistant</h1>
                    </div>
                    <div className="flex items-center gap-2">
                         <button
                            onClick={() => setIsContinuousListening(prev => !prev)}
                            className={`p-2 rounded-full relative transition-colors ${
                                isContinuousListening ? 'bg-red-600' : 'hover:bg-primary'
                            }`}
                            aria-label={isContinuousListening ? 'Stop listening' : 'Start continuous listening'}
                            title={isContinuousListening ? 'Stop listening' : 'Start continuous listening'}
                        >
                            <MicIcon className="w-6 h-6 text-white" />
                            {isContinuousListening && (
                                <span className="animate-ping absolute top-0 left-0 inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            )}
                        </button>
                        <button
                            onClick={handleToggleMute}
                            className="p-2 rounded-full hover:bg-primary transition-colors"
                            aria-label={isMuted ? 'Enable audio' : 'Mute audio'}
                            title={isMuted ? 'Enable audio' : 'Mute audio'}
                        >
                            {isMuted ? (
                                <SpeakerMuteIcon className="w-6 h-6 text-text-secondary" />
                            ) : (
                                <SpeakerIcon className="w-6 h-6 text-accent" />
                            )}
                        </button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 md:p-8 flex flex-col gap-8">
                <UrlInputForm onFetch={handleFetchInstructions} isLoading={isLoading || isModifying} />
                
                {error && <div className="bg-red-900 border border-red-700 text-red-200 p-4 rounded-lg">{error}</div>}
                
                {isLoading && (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent"></div>
                    </div>
                )}
                
                {instructionSet && !isLoading && (
                    <>
                        <InstructionDisplay 
                            instructionSet={instructionSet}
                            completedSteps={completedSteps}
                            onToggleStep={handleToggleStep}
                            onReadInstructions={handleReadInstructions}
                            onStopReading={handleStopReading}
                            isReadingInstructions={isReadingInstructions}
                            isMuted={isMuted}
                            onEcoSwitch={handleEcoSwitch}
                            isModifying={isModifying}
                            isEcoApplied={isEcoApplied}
                        />
                        <ActionButtons onModify={handleModifyInstructions} disabled={isBusy} />
                    </>
                )}
                
                {chatHistory.length > 0 && !isLoading && (
                    <div className="bg-secondary p-6 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold mb-4 text-accent">2. Ask for Help</h2>
                        <ChatInterface
                            chatHistory={chatHistory}
                            onSendMessage={handleSendMessage}
                            isAnswering={isAnswering || isModifying}
                            isContinuousListening={isContinuousListening}
                            onToggleListening={() => setIsContinuousListening(prev => !prev)}
                            isMuted={isMuted}
                            onSpeak={speak}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
