import React from 'react';
import { InstructionSet } from '../types';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';

interface InstructionDisplayProps {
    instructionSet: InstructionSet;
    completedSteps: boolean[];
    onToggleStep: (index: number) => void;
    onReadInstructions: () => void;
    onStopReading: () => void;
    isReadingInstructions: boolean;
    isMuted: boolean;
}

const InstructionDisplay: React.FC<InstructionDisplayProps> = ({ 
    instructionSet, 
    completedSteps, 
    onToggleStep,
    onReadInstructions,
    onStopReading,
    isReadingInstructions,
    isMuted
}) => {
    const allStepsCompleted = completedSteps.length > 0 && completedSteps.every(Boolean);

    return (
        <div className="bg-secondary p-6 rounded-lg shadow-lg animate-fade-in">
            <h2 className="text-3xl font-bold mb-6 border-b-2 border-accent pb-4">{instructionSet.title}</h2>

            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-accent">Materials / Ingredients</h3>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                    {instructionSet.materials.map((material, index) => (
                        <li key={index} className="pl-2">{material}</li>
                    ))}
                </ul>
            </div>

            <div>
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-accent">Steps / Instructions</h3>
                    {isReadingInstructions ? (
                        <button
                            onClick={onStopReading}
                            className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
                            aria-label="Stop reading instructions"
                        >
                            <StopIcon className="w-5 h-5" />
                            <span>Stop</span>
                        </button>
                    ) : (
                        <button
                            onClick={onReadInstructions}
                            disabled={isMuted || allStepsCompleted}
                            className="flex items-center gap-2 bg-accent text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                            aria-label="Read remaining instructions aloud"
                            title={allStepsCompleted ? "All steps are completed" : isMuted ? "Audio is muted" : "Read remaining steps"}
                        >
                            <PlayIcon className="w-5 h-5" />
                            <span>Read Aloud</span>
                        </button>
                    )}
                </div>
                <ol className="list-none space-y-4">
                    {instructionSet.steps.map((step, index) => (
                        <li 
                            key={index} 
                            className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-300 ${completedSteps[index] ? 'bg-green-900 bg-opacity-30' : 'bg-transparent'}`}
                        >
                            <span className="font-bold text-accent pt-1">{index + 1}.</span>
                            <div className="flex-1 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id={`step-${index}`}
                                    checked={completedSteps[index] ?? false}
                                    onChange={() => onToggleStep(index)}
                                    className="mt-1.5 h-5 w-5 rounded border-gray-500 bg-primary text-accent focus:ring-accent focus:ring-2 cursor-pointer"
                                    aria-label={`Mark step ${index + 1} as complete`}
                                />
                                <label
                                    htmlFor={`step-${index}`}
                                    className={`flex-1 leading-relaxed cursor-pointer transition-colors ${completedSteps[index] ? 'line-through text-text-secondary' : ''}`}
                                >
                                    {step}
                                </label>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            {instructionSet.sources && instructionSet.sources.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-xl font-semibold mb-4 text-accent">Sources</h3>
                    <ul className="list-disc list-inside space-y-2 text-text-secondary">
                        {instructionSet.sources.map((source, index) => (
                            <li key={index} className="pl-2">
                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{source.title || source.uri}</a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default InstructionDisplay;