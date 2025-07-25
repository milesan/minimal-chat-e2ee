import React, { createContext, useState, useContext } from 'react';

const QuoteContext = createContext();

export function QuoteProvider({ children }) {
  const [quotedMessage, setQuotedMessage] = useState(null);

  const quoteMessage = (message) => {
    setQuotedMessage(message);
  };

  const clearQuote = () => {
    setQuotedMessage(null);
  };

  return (
    <QuoteContext.Provider value={{ quotedMessage, quoteMessage, clearQuote }}>
      {children}
    </QuoteContext.Provider>
  );
}

export function useQuote() {
  const context = useContext(QuoteContext);
  if (!context) {
    throw new Error('useQuote must be used within a QuoteProvider');
  }
  return context;
}