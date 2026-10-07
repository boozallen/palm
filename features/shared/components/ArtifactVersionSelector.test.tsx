import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ArtifactVersionSelector, { ArtifactVersionSummary } from '@/features/shared/components/ArtifactVersionSelector';
import { appTheme } from '@/providers/AppMantineProvider';

// Renders with the app's Mantine theme so `theme.other.fontWeights` tokens resolve.
const renderWithTheme = (ui: React.ReactElement) => render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

const versions: ArtifactVersionSummary[] = [
  { versionNumber: 1, content: '# Original', createdAt: new Date('2024-01-01') },
  { versionNumber: 2, content: '# Edited', createdAt: new Date('2024-01-02') },
  { versionNumber: 3, content: '# Latest', createdAt: new Date() },
];

describe('ArtifactVersionSelector', () => {
  const onSelectIndex = jest.fn();
  const onRestore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the current version number and total count', () => {
    renderWithTheme(
      <ArtifactVersionSelector
        versions={versions}
        selectedIndex={2}
        onSelectIndex={onSelectIndex}
        onRestore={onRestore}
        isRestoring={false}
      />,
    );

    expect(screen.getByTestId('artifact-version-label')).toHaveTextContent('Version 3 of 3');
  });

  it('disables the previous arrow at the oldest version', () => {
    renderWithTheme(
      <ArtifactVersionSelector
        versions={versions}
        selectedIndex={0}
        onSelectIndex={onSelectIndex}
        onRestore={onRestore}
        isRestoring={false}
      />,
    );

    expect(screen.getByTestId('artifact-version-prev')).toBeDisabled();
  });

  it('disables the next arrow at the latest version', () => {
    renderWithTheme(
      <ArtifactVersionSelector
        versions={versions}
        selectedIndex={2}
        onSelectIndex={onSelectIndex}
        onRestore={onRestore}
        isRestoring={false}
      />,
    );

    expect(screen.getByTestId('artifact-version-next')).toBeDisabled();
  });

  it('navigates to the previous version when the previous arrow is clicked', () => {
    renderWithTheme(
      <ArtifactVersionSelector
        versions={versions}
        selectedIndex={2}
        onSelectIndex={onSelectIndex}
        onRestore={onRestore}
        isRestoring={false}
      />,
    );

    fireEvent.click(screen.getByTestId('artifact-version-prev'));

    expect(onSelectIndex).toHaveBeenCalledWith(1);
  });

  it('hides the restore button when viewing the latest version, without changing row height', () => {
    renderWithTheme(
      <ArtifactVersionSelector
        versions={versions}
        selectedIndex={2}
        onSelectIndex={onSelectIndex}
        onRestore={onRestore}
        isRestoring={false}
      />,
    );

    const restoreButton = screen.getByTestId('artifact-version-restore');
    expect(restoreButton).toBeDisabled();
    expect(restoreButton).not.toBeVisible();
  });

  it('shows the restore button and fires onRestore when viewing an older version', () => {
    renderWithTheme(
      <ArtifactVersionSelector
        versions={versions}
        selectedIndex={0}
        onSelectIndex={onSelectIndex}
        onRestore={onRestore}
        isRestoring={false}
      />,
    );

    const restoreButton = screen.getByTestId('artifact-version-restore');
    fireEvent.click(restoreButton);

    expect(onRestore).toHaveBeenCalled();
  });
});
