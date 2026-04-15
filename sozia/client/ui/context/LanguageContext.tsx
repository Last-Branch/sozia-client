import React, { createContext, useContext, useState, useMemo } from 'react';
import en from '../i18n/locales/en.json';
import tr from '../i18n/locales/tr.json';

export type Language = 'EN' | 'TR';

const dictionaries = {
  EN: en,
  TR: tr,
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: any) => string | any;
}

const LanguageContext = createContext<LanguageContextProps>({
  language: 'EN',
  setLanguage: () => {},
  t: () => '',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('EN');
  
  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  const contextValue = useMemo(() => {
    const t = (key: string, options?: { returnObjects?: boolean }): any => {
      const keys = key.split('.');
      let current: any = (dictionaries[language] as any)?.translation;
      
      for (const k of keys) {
        if (current === undefined) break;
        current = current[k];
      }
      
      // Fallback
      if (current === undefined && language === 'TR') {
        let fallback: any = (dictionaries['EN'] as any)?.translation;
        for (const k of keys) {
          if (fallback === undefined) break;
          fallback = fallback[k];
        }
        current = fallback;
      }
      
      if (current === undefined) return key;
      return current;
    };

    return { language, setLanguage: handleSetLanguage, t };
  }, [language]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
