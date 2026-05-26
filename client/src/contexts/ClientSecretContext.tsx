import { createContext, useContext, useState, ReactNode } from 'react';

interface ClientSecretContextType {
  clientSecret: string | null;
  setClientSecret: (secret: string | null) => void;
}

const ClientSecretContext = createContext<ClientSecretContextType | undefined>(undefined);

export const ClientSecretProvider = ({ children }: { children: ReactNode }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  return (
    <ClientSecretContext.Provider value={{ clientSecret, setClientSecret }}>
      {children}
    </ClientSecretContext.Provider>
  );
};

export const useClientSecret = () => {
  const context = useContext(ClientSecretContext);
  if (!context) {
    throw new Error('useClientSecret must be used within ClientSecretProvider');
  }
  return context;
};
