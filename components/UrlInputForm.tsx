
import React, { useState } from 'react';

interface UrlInputFormProps {
    onFetch: (url: string) => void;
    isLoading: boolean;
}

const UrlInputForm: React.FC<UrlInputFormProps> = ({ onFetch, isLoading }) => {
    const [url, setUrl] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onFetch(url);
    };

    return (
        <div className="bg-secondary p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-accent">1. Fetch Instructions</h2>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter instructions URL..."
                    className="flex-grow p-3 bg-primary border border-gray-600 rounded-md focus:ring-2 focus:ring-accent focus:outline-none transition"
                    disabled={isLoading}
                    required
                />
                <button
                    type="submit"
                    className="bg-accent text-white font-bold py-3 px-6 rounded-md hover:bg-indigo-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Fetching...
                        </>
                    ) : (
                        'Fetch Instructions'
                    )}
                </button>
            </form>
        </div>
    );
};

export default UrlInputForm;
