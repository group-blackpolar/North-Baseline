import { Anchor, Boat, Buildings, CalendarBlank, ChartLineUp, Clock, Cube, GlobeHemisphereWest, MapPin, Package, Scales, Star, Truck, TrendUp, UsersThree, WarningCircle, type Icon } from '@phosphor-icons/react';

/** The closed icon vocabulary of the document schema (`iconName` in CORECROW). Unknown names fall back to a neutral glyph. */
export const ICONS: Record<string, Icon> = {
  container: Package, scale: Scales, users: UsersThree, buildings: Buildings, globe: GlobeHemisphereWest, clock: Clock, ship: Boat,
  anchor: Anchor, pin: MapPin, chart: ChartLineUp, package: Cube, truck: Truck, calendar: CalendarBlank, trend: TrendUp, warning: WarningCircle, star: Star,
};
export const ICON_NAMES = Object.keys(ICONS);
export const iconOf = (name: unknown): Icon => (typeof name === 'string' ? ICONS[name] : undefined) ?? ChartLineUp;
