export enum OdramRiskRating {
  LOW = 'Low',
  MODERATE = 'Moderate',
  HIGH = 'High',
  NA = 'N/A',
}

export type OdramQuestionResult = {
  questionId: number;
  questionName: string;
  independentRating: OdramRiskRating;
  overallAssessment: string;
  keyFeedback: string[];
  teamRating: string;
};

export type OdramAnalysisResults = {
  questions: OdramQuestionResult[];
  summary: string | null;
};
