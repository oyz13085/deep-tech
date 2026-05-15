// PalmScan compartment types (ported from main branch)
export type FieldStatus  = 'healthy' | 'warning' | 'moderate' | 'severe';
export type DiseaseType  = 'None' | 'Leaf Spot' | 'Ganoderma' | 'Bud Rot' | 'Crown Disease';

export interface SensorData {
  humidity: number;
  soilPH: number;
  temperature: number;
}

export interface Field {
  id: string;
  name: string;
  status: FieldStatus;
  disease: DiseaseType;
  severity: number;
  area: number;
  palms: number;
  sensor: SensorData;
  coords: [number, number][][];
}
