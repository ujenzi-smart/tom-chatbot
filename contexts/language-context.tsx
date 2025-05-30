'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of the context data
interface LanguageContextType {
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  availableLanguages: { code: string; name: string }[];
}

// Create the context with a default undefined value (or a default context shape)
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Define a list of available languages
const defaultLanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  // Add more languages as needed
];

// Create the provider component
interface LanguageProviderProps {
  children: ReactNode;
  defaultLanguage?: string;
  languages?: { code: string; name: string }[];
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  defaultLanguage = 'en', // Default to English
  languages = defaultLanguages,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(defaultLanguage);

  return (
    <LanguageContext.Provider value={{ selectedLanguage, setSelectedLanguage, availableLanguages: languages }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Create a custom hook for easy context consumption
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
