import { createContext, useEffect, useState, useContext } from "react";

const initialState = {
  theme: "system",
  setTheme: () => null,
};

export const ThemeProviderContext = createContext(initialState);

export function ThemeProvider({ children, defaultTheme = "light", storageKey = "keep-react-theme", ...props }) {
  // Always force light theme; do not persist or read any stored value
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

  root.classList.add("light");
  }, [theme]);

  const value = {
    theme,
  setTheme: () => setThemeState("light"),
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
