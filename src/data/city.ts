/** Plan de la ville (F-PRO-1, F-PRO-2) : un quadrillage de rues et trois lieux. */
export type PlaceId = 'home' | 'park' | 'gym' | 'market';

export interface CityNode {
  id: string;
  col: number;
  row: number;
  place?: PlaceId;
}

export const CITY_COLS = 6;
export const CITY_ROWS = 6;

const PLACES: Record<string, PlaceId> = { '2-5': 'home', '0-0': 'park', '5-2': 'gym', '4-0': 'market' };

export const CITY: CityNode[] = Array.from({ length: CITY_COLS * CITY_ROWS }, (_, i) => {
  const col = i % CITY_COLS;
  const row = Math.floor(i / CITY_COLS);
  const id = `${col}-${row}`;
  const place = PLACES[id];
  return place ? { id, col, row, place } : { id, col, row };
});

export const CITY_BY_ID: Record<string, CityNode> = Object.fromEntries(CITY.map((n) => [n.id, n]));
export const HOME_NODE = '2-5';

export const PLACE_LABELS: Record<PlaceId, string> = { home: 'Maison', park: 'Parc', gym: 'Gymnase', market: 'Brocante' };
