import core from "@/data/i18n-core.json";
import world from "@/data/i18n-world.json";

export type Dict = Record<string, string>;

const packs = { ...(core as Record<string, Dict>), ...(world as Record<string, Dict>) };

const extra: Record<string, Dict> = {
  en: {
    hosted: "Hosted coach · $9/mo",
    auto: "Auto",
    journeyman: "Journeyman",
    search: "Search shows",
    live: "On now",
    finalist: "Finalist",
    third: "Third",
    second: "Second",
    first: "First",
    none: "No placement",
    sample: "Load a sample record",
    model: "Planning model, not a judge.",
    keyHint: "Key from console.x.ai. Stays on this device.",
    noCharge: "Nothing is charged in this preview.",
    translate: "Translate interface",
    asking: "Asking…",
    coachHint: "Packing, call time, budget — for the show you picked.",
    bestNet: "Best net",
    pinned: "Pinned",
    spinSpeed: "Spin",
    field: "Field",
    perDiem: "Food / day",
    optimal: "Optimal purse",
    disclaimer:
      "Dates were checked against organizer pages where we could. Prices, hotels, and purses are planning estimates unless the note says published. Win chance is a model, not a promise.",
    cat_anime: "Anime",
    cat_game: "Game",
    cat_comic: "Comic",
    cat_original: "Original",
    cat_historical: "Historical",
    cat_craft: "Craft",
    reg_na: "North America",
    reg_eu: "Europe",
    reg_apac: "Asia-Pacific",
    sort_soonest: "Soonest",
    sort_closest: "Closest",
    sort_bestValue: "Best net",
    sort_highestPrize: "Highest purse",
    sort_winChance: "Win chance",
    locateFail: "Location blocked. Pick a city.",
    needPlace: "Pick a city to price the journey.",
    needShow: "Open a show.",
    needKey: "Paste your key, or switch on the hosted coach.",
    oneway: "One way",
    round: "Round trip",
    top3: "Top 3",
    published: "Published purse",
    unpublished: "No cash purse published",
    cloudflare: "Cloudflare",
    cloudflareBody:
      "The calendar runs here. A Worker in the repo answers /api/coach on Cloudflare: wrangler secret put XAI_API_KEY. Visitors can paste their own key. The $9 figure is the hosted-plan price — this app does not take a card.",
    themeDay: "Light blue",
    themeNight: "Dark",
  },
  sv: {
    hosted: "Värdcoach · 9 USD/mån",
    auto: "Auto",
    journeyman: "Journeyman",
    search: "Sök evenemang",
    live: "Pågår",
    finalist: "Finalist",
    third: "Trean",
    second: "Tvåan",
    first: "Etta",
    none: "Ingen placering",
    sample: "Ladda ett exempel",
    model: "Planeringsmodell, inte en domare.",
    keyHint: "Nyckel från console.x.ai. Stannar på den här enheten.",
    noCharge: "Inget dras i den här förhandsvisningen.",
    translate: "Översätt gränssnittet",
    asking: "Frågar…",
    coachHint: "Packning, call time, budget — för showen du valt.",
    bestNet: "Bästa netto",
    pinned: "Nålad",
    spinSpeed: "Snurr",
    field: "Fält",
    perDiem: "Mat / dag",
    optimal: "Optimal prispott",
    disclaimer:
      "Datum är kollade mot arrangörssidor där det gick. Priser, hotell och potter är uppskattningar om noten inte säger publicerat. Vinstchans är en modell, inte ett löfte.",
    cat_anime: "Anime",
    cat_game: "Spel",
    cat_comic: "Serier",
    cat_original: "Original",
    cat_historical: "Historiskt",
    cat_craft: "Hantverk",
    reg_na: "Nordamerika",
    reg_eu: "Europa",
    reg_apac: "Asien–Stillahavet",
    sort_soonest: "Tidigast",
    sort_closest: "Närmast",
    sort_bestValue: "Bästa netto",
    sort_highestPrize: "Högsta pott",
    sort_winChance: "Vinstchans",
    locateFail: "Platsen blockerades. Välj en stad.",
    needPlace: "Välj en stad för att räkna resan.",
    needShow: "Öppna en show.",
    needKey: "Klistra in din nyckel, eller slå på värdcoachen.",
    oneway: "Enkel",
    round: "Tur och retur",
    top3: "Topp 3",
    published: "Publicerad pott",
    unpublished: "Ingen kontantpott publicerad",
    cloudflare: "Cloudflare",
    cloudflareBody:
      "Kalendern körs här. En Worker i repot svarar på /api/coach i Cloudflare: wrangler secret put XAI_API_KEY. Besökare kan klistra in egen nyckel. 9 USD är priset för värdplanen — appen tar inget kort.",
  },
};

export const LOCALES: { id: string; label: string }[] = [
  { id: "en", label: "English" },
  { id: "sv", label: "Svenska" },
  { id: "de", label: "Deutsch" },
  { id: "fr", label: "Français" },
  { id: "es", label: "Español" },
  { id: "it", label: "Italiano" },
  { id: "pt", label: "Português" },
  { id: "nl", label: "Nederlands" },
  { id: "da", label: "Dansk" },
  { id: "no", label: "Norsk" },
  { id: "fi", label: "Suomi" },
  { id: "pl", label: "Polski" },
  { id: "ja", label: "日本語" },
  { id: "zh", label: "中文" },
  { id: "ko", label: "한국어" },
  { id: "ar", label: "العربية" },
  { id: "ru", label: "Русский" },
  { id: "tr", label: "Türkçe" },
  { id: "hi", label: "हिन्दी" },
  { id: "th", label: "ไทย" },
];

export const CORE_LOCALES = new Set(Object.keys(packs));

export function dictionary(locale: string, overlay?: Dict): Dict {
  return {
    ...extra.en,
    ...packs.en,
    ...(extra[locale] ?? {}),
    ...(packs[locale] ?? {}),
    ...(overlay ?? {}),
  };
}

export function t(dict: Dict, key: string) {
  return dict[key] ?? extra.en[key] ?? packs.en[key] ?? key;
}

export function englishPack(): Dict {
  return { ...extra.en, ...packs.en };
}
