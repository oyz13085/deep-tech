export type PageId =
  | 'drone'
  | 'tls'
  | 'report';

export type BlockStatus =
  | 'No visible severe canopy anomaly'
  | 'TLS confirmation required';

export type BlockRecord = {
  id: number;
  name: string;
  status: BlockStatus;
};

export type StageKey = 'stage0' | 'stage1' | 'stage2' | 'stage34';

export type StageRecord = {
  key: StageKey;
  label: string;
  shortLabel: string;
  palms: number;
  color: string;
};

export type PriorityPalm = {
  treeId: string;
  rowZone: string;
  stage: string;
  confidence: string;
  action: string;
};

export type ToastMessage = {
  id: number;
  message: string;
};
