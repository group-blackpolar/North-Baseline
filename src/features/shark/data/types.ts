export interface SharkRecord {
  year: number;
  month: number;
  port: string;
  carrier: string;
  consignee: string;
  country: string;
  containers: number;
  teus: number;
}

export interface PortFilters {
  port: string;
  year: string;
  carrier: string;
  month: string;
}

export interface PortReport {
  containers: number;
  teus: number;
  monthly: Array<{ label: string; containers: number }>;
  byPort: Array<{ label: string; containers: number }>;
  byCarrier: Array<{ label: string; containers: number }>;
  topConsignees: Array<{ label: string; containers: number; teus: number; share: number }>;
}