import React from 'react';

interface ActionButtonsProps {
    onModify: (prompt: string) => void;
    disabled: boolean;
}

const ActionButton: React.FC<{ onClick: () => void; disabled: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex-1 bg-primary text-text-primary font-semibold py-2 px-4 rounded-md hover:bg-accent hover:text-white transition-colors disabled:bg-opacity-50 disabled:text-text-secondary disabled:cursor-not-allowed text-sm"
    >
        {children}
    </button>
);

const actionGroups = [
    {
        title: 'Scale Materials',
        actions: [
            { label: '2x', prompt: 'Double the materials list. Provide the complete new list.' },
            { label: '3x', prompt: 'Triple the materials list. Provide the complete new list.' },
            { label: '5x', prompt: 'Quintuple the materials list. Provide the complete new list.' },
        ]
    },
    {
        title: 'Convert Units',
        actions: [
            { label: 'To Metric', prompt: 'Convert all units in the materials list and steps to metric (e.g., cups to ml, F to C). Provide the complete new list.' },
            { label: 'To Imperial', prompt: 'Convert all units in the materials list and steps to US Imperial (e.g., ml to cups, C to F). Provide the complete new list.' },
        ]
    }
];

const ActionButtons: React.FC<ActionButtonsProps> = ({ onModify, disabled }) => {
    return (
        <div className="bg-secondary p-4 rounded-lg shadow-lg animate-fade-in">
             <h3 className="text-lg font-bold mb-4 text-accent border-b border-gray-700 pb-2">Quick Actions</h3>
            <div className="flex flex-col md:flex-row gap-8">
                {actionGroups.map((group) => (
                    <div key={group.title} className="flex-1">
                        <h4 className="text-md font-semibold mb-3 text-text-secondary">{group.title}</h4>
                        <div className={`grid ${group.actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                            {group.actions.map(({ label, prompt }) => (
                                 <ActionButton
                                    key={label}
                                    onClick={() => onModify(prompt)}
                                    disabled={disabled}
                                >
                                    {label}
                                </ActionButton>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ActionButtons;