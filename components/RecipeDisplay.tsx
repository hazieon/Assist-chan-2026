
import React from 'react';
import { InstructionSet } from '../types';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';
import { LeafIcon } from './icons/LeafIcon';
import { SmileIcon } from './icons/SmileIcon';

interface InstructionDisplayProps {
    instructionSet: InstructionSet;
    completedSteps: boolean[];
    onToggleStep: (index: number) => void;
    onReadInstructions: () => void;
    onStopReading: () => void;
    isReadingInstructions: boolean;
    isMuted: boolean;
    onEcoSwitch: () => void;
    isModifying: boolean;
    isEcoApplied: boolean;
}

const InstructionDisplay: React.FC<InstructionDisplayProps> = ({ 
    instructionSet, 
    completedSteps, 
    onToggleStep,
    onReadInstructions,
    onStopReading,
    isReadingInstructions,
    isMuted,
    onEcoSwitch,
    isModifying,
    isEcoApplied
}) => {
    const allStepsCompleted = completedSteps.length > 0 && completedSteps.every(Boolean);
    
    // Always show if it's a food recipe
    const showEcoButton = !!instructionSet.isFood;

    return (
        <div className="bg-secondary p-5 md:p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 border-b border-gray-700 pb-4 leading-tight">
                {instructionSet.title}
            </h2>

            <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-accent uppercase tracking-wider">Materials</h3>
                    {showEcoButton && (
                        <button
                            onClick={onEcoSwitch}
                            disabled={isModifying || isEcoApplied}
                            className={`flex items-center justify-center rounded-full p-2.5 transition-all shadow-md active:scale-90 ${
                                isEcoApplied 
                                ? 'bg-green-800/40 cursor-not-allowed opacity-90' 
                                : 'bg-green-600 hover:bg-green-500'
                            }`}
                            aria-label={isEcoApplied ? "Already sustainable" : "Switch to sustainable version"}
                            title={isEcoApplied ? "Already sustainable!" : "Make it eco-friendly"}
                        >
                            {isEcoApplied ? (
                                <SmileIcon className="w-7 h-7 text-green-400" />
                            ) : (
                                <LeafIcon className="w-7 h-7 text-white animate-pulse" />
                            )}
                        </button>
                    )}
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm md:text-base text-text-secondary">
                    {instructionSet.materials.map((material, index) => (
                        <li key={index} className="flex items-start gap-2 bg-primary/30 p-2 rounded">
                            <span className="text-accent">•</span> {material}
                        </li>
                    ))}
                </ul>
            </section>

            <section>
                 <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold text-accent uppercase tracking-wider">Instructions</h3>
                    {isReadingInstructions ? (
                        <button
                            onClick={onStopReading}
                            className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-500 transition-all active:scale-95 text-sm"
                        >
                            <StopIcon className="w-4 h-4" />
                            Stop
                        </button>
                    ) : (
                        <button
                            onClick={onReadInstructions}
                            disabled={isMuted || allStepsCompleted}
                            className="flex items-center gap-2 bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500 transition-all active:scale-95 text-sm disabled:opacity-40"
                        >
                            <PlayIcon className="w-4 h-4" />
                            Read All
                        </button>
                    )}
                </div>
                <ol className="space-y-4">
                    {instructionSet.steps.map((step, index) => (
                        <li 
                            key={index} 
                            className={`flex items-start gap-3 p-4 rounded-lg transition-all border border-transparent ${
                                completedSteps[index] 
                                ? 'bg-green-900/10 border-green-800/30 text-text-secondary italic line-through' 
                                : 'bg-primary/40'
                            }`}
                        >
                            <div className="flex-shrink-0 mt-1">
                                <input
                                    type="checkbox"
                                    id={`step-${index}`}
                                    checked={completedSteps[index] ?? false}
                                    onChange={() => onToggleStep(index)}
                                    className="h-6 w-6 rounded border-gray-600 bg-primary text-accent focus:ring-accent cursor-pointer"
                                />
                            </div>
                            <label
                                htmlFor={`step-${index}`}
                                className="flex-1 text-sm md:text-base leading-relaxed cursor-pointer select-none"
                            >
                                <span className="font-bold mr-2 text-accent">{index + 1}.</span>
                                {step}
                            </label>
                        </li>
                    ))}
                </ol>
            </section>

            {instructionSet.sources && instructionSet.sources.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-700">
                    <h3 className="text-xs font-semibold text-text-secondary uppercase mb-3">Sources</h3>
                    <div className="flex flex-wrap gap-3">
                        {instructionSet.sources.map((source, index) => (
                            <a 
                                key={index} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs bg-primary/50 px-3 py-1.5 rounded-full text-accent hover:underline flex items-center gap-1"
                            >
                                {source.title || 'View Source'} ↗
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstructionDisplay;
