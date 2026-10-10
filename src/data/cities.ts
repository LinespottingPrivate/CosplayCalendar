import raw from "./cities.json";

export type City = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
};

export const cities: City[] = [
  ...(raw as City[]),
  { id: "dusseldorf", name: "Düsseldorf", country: "Germany", lat: 51.23, lng: 6.78 },
];
