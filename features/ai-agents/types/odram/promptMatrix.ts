export type PromptMatrixQuestion = {
  id: number;
  name: string;
  objective: string;
  extractionInstructions: string;
  riskDefinitions: {
    low: string;
    moderate: string;
    high: string;
  };
  handbookGuidance: string;
};

export type PromptMatrixData = {
  persona: string;
  step1Intro: string;
  step2Intro: string;
  responseGuidelines: string;
  questions: PromptMatrixQuestion[];
};
