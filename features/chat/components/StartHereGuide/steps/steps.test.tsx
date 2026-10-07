import { renderWrapper } from '@/test/test-utils';
import { screen } from '@testing-library/react';

import ChooseModelStep from './ChooseModelStep';
import UploadDocumentStep from './UploadDocumentStep';
import AskQuestionStep from './AskQuestionStep';
import GetAnswerStep from './GetAnswerStep';
import { MOCK } from './content';

// Force the reduced-motion path so the final frame renders synchronously.
jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useReducedMotion: () => true,
}));

describe('start-here step components', () => {
  it('ChooseModelStep shows the selected model at final frame', () => {
    renderWrapper(<ChooseModelStep active />);
    expect(screen.getByText(MOCK.selectedModel)).toBeInTheDocument();
  });

  it('UploadDocumentStep shows the add-menu options at final frame', () => {
    renderWrapper(<UploadDocumentStep active />);
    MOCK.addMenuOptions.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('AskQuestionStep shows the sample question at final frame', () => {
    renderWrapper(<AskQuestionStep active />);
    expect(screen.getByText(MOCK.question)).toBeInTheDocument();
  });

  it('GetAnswerStep shows the artifact name at final frame', () => {
    renderWrapper(<GetAnswerStep active />);
    expect(screen.getByText(MOCK.artifactName)).toBeInTheDocument();
  });
});
