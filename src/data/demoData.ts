import type { BlockRecord, PageId, PriorityPalm, StageRecord } from '../types';

export const estate = {
  productName: 'Dr. Palm',
  name: 'Johor Estate A',
  sizeHa: 500,
  blocks: 12,
  user: 'Ahmad',
  role: 'Estate Manager',
  auditCycle: 'Q2 2026',
  preScreeningMethod: 'Drone / field pre-screening',
  yieldAtRisk: 280000,
  estimatedAnnualRevenueBaseline: 1550000,
  auditVisitCost: 8433,
};

export const pageSteps: { id: PageId; label: string }[] = [
  { id: 'scan', label: 'Scan & Classify' },
  { id: 'report', label: 'Audit Report' },
];

export const progressLabels = [
  'Estate scan & classification',
  'Report generated',
];

export const blocks: BlockRecord[] = [
  { id: 1, name: 'Block 1', status: 'No visible severe canopy anomaly' },
  { id: 2, name: 'Block 2', status: 'No visible severe canopy anomaly' },
  { id: 3, name: 'Block 3', status: 'No visible severe canopy anomaly' },
  { id: 4, name: 'Block 4', status: 'No visible severe canopy anomaly' },
  { id: 5, name: 'Block 5', status: 'No visible severe canopy anomaly' },
  { id: 6, name: 'Block 6', status: 'No visible severe canopy anomaly' },
  { id: 7, name: 'Block 7', status: 'TLS confirmation required' },
  { id: 8, name: 'Block 8', status: 'No visible severe canopy anomaly' },
  { id: 9, name: 'Block 9', status: 'TLS confirmation required' },
  { id: 10, name: 'Block 10', status: 'No visible severe canopy anomaly' },
  { id: 11, name: 'Block 11', status: 'No visible severe canopy anomaly' },
  { id: 12, name: 'Block 12', status: 'No visible severe canopy anomaly' },
];

export const blockStatusColors = {
  'No visible severe canopy anomaly': '#2EAD5B',
  'TLS confirmation required': '#EB5757',
} as const;

export const neutralBlockColor = '#CFD8CD';

export const tlsScan = {
  block: 'TLS-scanned zone — Block 7 flagged cluster',
  scanType: 'Targeted TLS confirmation',
  scope: '~1.5 ha targeted TLS scan zone: flagged GPS zone + 2-row buffer',
  palmsScanned: 204,
  bsrPriorityPalms: 151,
  urgentPalms: 23,
  yieldAtRisk: 280000,
};

export const stages: StageRecord[] = [
  {
    key: 'stage0',
    label: 'Stage 0 Healthy / No BSR Priority',
    shortLabel: 'Stage 0',
    palms: 53,
    color: '#2EAD5B',
  },
  {
    key: 'stage1',
    label: 'Stage 1 Mild Priority',
    shortLabel: 'Stage 1',
    palms: 87,
    color: '#F2C94C',
  },
  {
    key: 'stage2',
    label: 'Stage 2 Moderate Priority',
    shortLabel: 'Stage 2',
    palms: 41,
    color: '#F2994A',
  },
  {
    key: 'stage34',
    label: 'Stage 3–4 Severe/Critical Priority',
    shortLabel: 'Stage 3–4',
    palms: 23,
    color: '#EB5757',
  },
];

export const priorityPalms: PriorityPalm[] = [
  {
    treeId: 'B7-T0921',
    rowZone: 'Row 16 / NE',
    stage: 'Stage 3–4 Severe/Critical',
    confidence: '91%',
    action: 'Ground confirm + isolate zone',
  },
  {
    treeId: 'B7-T0884',
    rowZone: 'Row 15 / NE',
    stage: 'Stage 3–4 Severe/Critical',
    confidence: '89%',
    action: 'Ground confirm + sanitation review',
  },
  {
    treeId: 'B7-T0733',
    rowZone: 'Row 15 / NE',
    stage: 'Stage 2 Moderate',
    confidence: '84%',
    action: 'Inspect within 7 days',
  },
  {
    treeId: 'B7-T0602',
    rowZone: 'Row 14 / NE',
    stage: 'Stage 1 Mild',
    confidence: '76%',
    action: 'Rescan in 30 days',
  },
];

export const roiScenarios = [
  { name: 'Conservative', value: 120000, label: 'RM120k potential value exposed' },
  { name: 'Base Case', value: 280000, label: 'RM280k potential value exposed' },
  { name: 'High-Risk', value: 520000, label: 'RM520k potential value exposed' },
];

export const financialComparison = [
  { name: 'Estimated visit cost', low: 8433, high: 8433, displayed: 8433 },
  { name: 'Yield-at-risk identified', low: 280000, high: 280000, displayed: 280000 },
];

export const requiredFooterText =
  'Commercial workflow prototype • Demo data simulated • Field validation required';

export const decisionSupportFooterText =
  'AI-assisted decision support • Ground confirmation required • Agronomist review required';
