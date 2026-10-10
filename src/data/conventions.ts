import apac from "./plan-apac.json";
import eu from "./plan-eu.json";
import na from "./plan-na.json";

export type Category =
  | "anime"
  | "game"
  | "comic"
  | "original"
  | "historical"
  | "craft";

export type Region = "na" | "eu" | "apac";

export type Convention = {
  id: string;
  name: string;
  city: string;
  country: string;
  region: Region;
  venue: string | null;
  start: string;
  end: string;
  lat: number;
  lng: number;
  website: string;
  badgePriceUsd: number;
  hotelPerNightUsd: number;
  contestPrizeUsd: number | null;
  categories: Category[];
  heat: number;
  indoor: boolean;
  notes: string;
};

const extras: Convention[] = [
  {
    id: "nycc-2026",
    name: "New York Comic Con",
    city: "New York",
    country: "United States",
    region: "na",
    venue: "Jacob K. Javits Convention Center",
    start: "2026-10-08",
    end: "2026-10-11",
    lat: 40.7578,
    lng: -74.0024,
    website: "https://www.newyorkcomiccon.com/",
    badgePriceUsd: 350,
    hotelPerNightUsd: 420,
    contestPrizeUsd: 1000,
    categories: ["comic", "game", "anime", "original", "craft"],
    heat: 8,
    indoor: true,
    notes:
      "Running 8–11 Oct 2026 at the Javits Center. 4-day badges were reported around $321 early and $371 later. The 2026 Cosplay Central Crown qualifier published a $1,000 first-place purse. Hotel is an estimate.",
  },
  {
    id: "narcon-expo-2026",
    name: "NärCon Expo",
    city: "Södertälje",
    country: "Sweden",
    region: "eu",
    venue: "Södertälje Stadsscen",
    start: "2026-11-21",
    end: "2026-11-22",
    lat: 59.1956,
    lng: 17.627,
    website: "https://en.narcon.se/",
    badgePriceUsd: 28,
    hotelPerNightUsd: 140,
    contestPrizeUsd: null,
    categories: ["anime", "game", "craft"],
    heat: 5,
    indoor: true,
    notes:
      "Confirmed on the NärCon site for 21–22 Nov 2026. Badge and hotel are planning estimates. No published cash purse found.",
  },
  {
    id: "desucon-frostbite-2027",
    name: "Desucon Frostbite",
    city: "Lahti",
    country: "Finland",
    region: "eu",
    venue: "Sibelius Hall",
    start: "2027-01-22",
    end: "2027-01-24",
    lat: 60.9949,
    lng: 25.6512,
    website: "https://desucon.fi/",
    badgePriceUsd: 44,
    hotelPerNightUsd: 130,
    contestPrizeUsd: null,
    categories: ["anime", "game", "craft"],
    heat: 6,
    indoor: true,
    notes:
      "Winter edition 22–24 Jan 2027 at Sibeliustalo, announced with the summer dates. Badge carries over the recent €39 weekend as an estimate. No published cash purse.",
  },
  {
    id: "narcon-vinter-2027",
    name: "NärCon Vinter",
    city: "Linköping",
    country: "Sweden",
    region: "eu",
    venue: "Linköping University",
    start: "2027-02-25",
    end: "2027-02-28",
    lat: 58.3972,
    lng: 15.5764,
    website: "https://en.narcon.se/",
    badgePriceUsd: 30,
    hotelPerNightUsd: 140,
    contestPrizeUsd: null,
    categories: ["anime", "game", "original", "craft"],
    heat: 7,
    indoor: true,
    notes:
      "Confirmed 25–28 Feb 2027 in Linköping. Badge uses the recent day-ticket scale as an estimate. Prize purse not published.",
  },
  {
    id: "stockholm-summer-2027",
    name: "Comic Con Stockholm Summer",
    city: "Stockholm",
    country: "Sweden",
    region: "eu",
    venue: "Kistamässan",
    start: "2027-05-08",
    end: "2027-05-09",
    lat: 59.4035,
    lng: 17.944,
    website: "https://www.comicconstockholm.se/en/",
    badgePriceUsd: 45,
    hotelPerNightUsd: 190,
    contestPrizeUsd: null,
    categories: ["comic", "game", "anime"],
    heat: 6,
    indoor: true,
    notes:
      "Official Comic Con Stockholm page: 8–9 May 2027 at Kistamässan. 2027 badge price not used here as a quote — figure is a planning estimate near the winter day ticket. No published cash purse.",
  },
];

export const conventions: Convention[] = [
  ...(na as Convention[]),
  ...(eu as Convention[]),
  ...(apac as Convention[]),
  ...extras,
].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));

export const CATEGORIES: Category[] = [
  "anime",
  "game",
  "comic",
  "original",
  "historical",
  "craft",
];

export const REGIONS: Region[] = ["na", "eu", "apac"];
