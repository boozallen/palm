export type StepId = 'model' | 'upload' | 'ask' | 'answer';

export type StepProps = { active: boolean; onComplete?: () => void };

export const STEP_ORDER: StepId[] = ['model', 'upload', 'ask', 'answer'];

export const STEP_COUNT = STEP_ORDER.length;

export const STEP_CONTENT: Record<StepId, { title: string; caption: string }> = {
  model: {
    title: 'Choose your model',
    caption: 'Choose an AI model to work with. Once you get access and enter your join code, all the models in the drop down will be enabled for you.',
  },
  upload: {
    title: 'Add your own context',
    caption: 'Open the + menu to add data sources or edit the system persona, so answers are grounded in the documents and context you’re working with.',
  },
  ask: {
    title: 'Start a conversation',
    caption: 'Work on any deliverable — proposals, marketing plans, product requirement documents, market research — right in the chat.',
  },
  answer: {
    title: 'Create your deliverable',
    caption: 'Depending on the conversation, the AI models can generate documents, spreadsheets, HTML presentations, PPTs, and video. Ask for what you want and let the agentic chat go to work. If you have feedback on the output, provide new instructions and iterate on your deliverable.',
  },
};

export const MOCK = {
  modelOptions: ['Claude Opus 4.8', 'Claude Sonnet 5', 'Claude Haiku 4.5'],
  selectedModel: 'Claude Sonnet 5',
  addMenuOptions: ['Add data sources', 'Edit system persona'],
  fileName: 'quarterly-report.pdf',
  question: 'Based on the uploaded proposal documentation, help me create a technical response. Go through each requirement one at a time and respond to each.',
  answerLines: [
    'I responded to each requirement in the proposal:',
    '• All requirements are written to.',
    '• Content generated with the Software House Content Engine tool.',
  ],
  artifactName: 'proposal-response.docx',
};
