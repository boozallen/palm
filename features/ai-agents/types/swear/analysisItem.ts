export enum AnalysisStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  PARTIAL = 'PARTIAL',
  NA = 'N/A',
}

export enum AnalysisConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export type AnalysisItem = {
  category: string;
  requirement: string;
  status: AnalysisStatus;
  confidence: AnalysisConfidence;
  evidence: string;
};
