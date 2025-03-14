"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

interface ThemeContextProps {
  theme?: "light" | "dark" | "system"
  setTheme: (theme: "light" | "dark" | "system") => void
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: "system",
  setTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: "system" | "light" | "dark"
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({
  children,
  attribute,
  defaultTheme,
  enableSystem,
  disableTransitionOnChange,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTheme((localStorage.getItem("theme") as "light" | "dark" | "system") || defaultTheme || "system")
    }
  }, [defaultTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <NextThemesProvider
        // attribute={attribute}
        defaultTheme={defaultTheme}
        enableSystem={enableSystem}
        disableTransitionOnChange={disableTransitionOnChange}
      >
        {children}
      </NextThemesProvider>
    </ThemeContext.Provider>
  )
}

