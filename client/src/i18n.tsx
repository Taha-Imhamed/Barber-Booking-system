import { createContext, useContext, useMemo, useState } from "react";

type Lang = "en" | "tr";
type Dictionary = Record<string, { en: string; tr: string }>;

const dictionary: Dictionary = {
  language: { en: "Language", tr: "Dil" },
  english: { en: "English", tr: "Ingilizce" },
  turkish: { en: "Turkish", tr: "Turkce" },
  signIn: { en: "Sign In", tr: "Giris Yap" },
  signOut: { en: "Logout", tr: "Cikis Yap" },
  timetable: { en: "Timetable", tr: "Zaman Cizelgesi" },
  branches: { en: "Branches", tr: "Subeler" },
  wallDisplay: { en: "Wall Display", tr: "Ekran" },
  backHome: { en: "Back to home", tr: "Ana sayfaya don" },
  googleSignIn: { en: "Continue with Google", tr: "Google ile devam et" },
  verifyEmailNote: {
    en: "New accounts must verify email before login.",
    tr: "Yeni hesaplar giris oncesi e-posta dogrulamali.",
  },
  team: { en: "Our Team", tr: "Ekibimiz" },
  reserveWith: { en: "Reserve with", tr: "Su berberle randevu al" },
  confirmReserve: { en: "Start reservation with this barber?", tr: "Bu berberle rezervasyon baslatilsin mi?" },
  yes: { en: "Yes", tr: "Evet" },
  no: { en: "No", tr: "Hayir" },
};

const I18nContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dictionary) => string;
}>({
  lang: "en",
  setLang: () => {},
  t: (key) => dictionary[key].en,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem("lang");
    return stored === "tr" ? "tr" : "en";
  });

  const value = useMemo(
    () => ({
      lang,
      setLang: (next: Lang) => {
        localStorage.setItem("lang", next);
        setLang(next);
      },
      t: (key: keyof typeof dictionary) => dictionary[key][lang],
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

