"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_EXCHANGE_RATE, fetchLiveExchangeRate } from "@/lib/currency";

export type CountryCode = "GT" | "SV";

interface CountryContextType {
  country: CountryCode;
  currency: "GTQ" | "USD";
  currencySymbol: "Q" | "$";
  countryName: string;
  countryFlag: string;
  exchangeRate: number;
  setCountry: (country: CountryCode) => void;
  formatPrice: (priceGTQ: number, priceUSD?: number | null) => string;
  getRawPrice: (priceGTQ: number, priceUSD?: number | null) => number;
}

const CountryContext = createContext<CountryContextType>({
  country: "GT",
  currency: "GTQ",
  currencySymbol: "Q",
  countryName: "Guatemala",
  countryFlag: "🇬🇹",
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  setCountry: () => {},
  formatPrice: () => "",
  getRawPrice: () => 0,
});

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState<CountryCode>("GT");
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);

  useEffect(() => {
    // Check saved country preference
    const saved = localStorage.getItem("preferred_country") as CountryCode;
    if (saved === "GT" || saved === "SV") {
      setCountryState(saved);
    }
    // Fetch live exchange rate
    fetchLiveExchangeRate().then(rate => setExchangeRate(rate));
  }, []);

  const setCountry = (newCountry: CountryCode) => {
    setCountryState(newCountry);
    localStorage.setItem("preferred_country", newCountry);
  };

  const currency = country === "GT" ? "GTQ" : "USD";
  const currencySymbol = country === "GT" ? "Q" : "$";
  const countryName = country === "GT" ? "Guatemala" : "El Salvador";
  const countryFlag = country === "GT" ? "🇬🇹" : "🇸🇻";

  const getRawPrice = (priceGTQ: number, priceUSD?: number | null): number => {
    if (country === "SV") {
      if (priceUSD !== undefined && priceUSD !== null && priceUSD > 0) {
        return priceUSD;
      }
      return Math.round((priceGTQ / exchangeRate) * 20) / 20;
    }
    return priceGTQ;
  };

  const formatPrice = (priceGTQ: number, priceUSD?: number | null): string => {
    const val = getRawPrice(priceGTQ, priceUSD);
    if (country === "SV") {
      return `$${val.toFixed(2)} USD`;
    }
    return `Q${val.toFixed(2)}`;
  };

  return (
    <CountryContext.Provider
      value={{
        country,
        currency,
        currencySymbol,
        countryName,
        countryFlag,
        exchangeRate,
        setCountry,
        formatPrice,
        getRawPrice
      }}
    >
      {children}
    </CountryContext.Provider>
  );
}

export const useCountry = () => useContext(CountryContext);
