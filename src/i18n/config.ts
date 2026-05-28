import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import nl from "./locales/nl.json";
import pl from "./locales/pl.json";
import pt from "./locales/pt.json";
import ru from "./locales/ru.json";
import tr from "./locales/tr.json";
import zh from "./locales/zh.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      tr: { translation: tr },
      de: { translation: de },
      es: { translation: es },
      fr: { translation: fr },
      it: { translation: it },
      pt: { translation: pt },
      ru: { translation: ru },
      zh: { translation: zh },
      ja: { translation: ja },
      ko: { translation: ko },
      ar: { translation: ar },
      nl: { translation: nl },
      pl: { translation: pl },
    },
    fallbackLng: "en",
    supportedLngs: [
      "en", "tr", "de", "es", "fr", "it", "pt",
      "ru", "zh", "ja", "ko", "ar", "nl", "pl",
    ],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "zonaly.lang",
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
