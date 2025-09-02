import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import SelectedTextSent from './SelectedTextSent';

// Wrapper component for Mantine provider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('SelectedTextSent', () => {
  describe('rendering', () => {
    it('should render with valid content', () => {
      render(
        <TestWrapper>
          <SelectedTextSent content='Test selected text' />
        </TestWrapper>
      );

      expect(screen.getByText('Test selected text')).toBeInTheDocument();
    });

    it('should render the corner down right icon', () => {
      render(
        <TestWrapper>
          <SelectedTextSent content='Test content' />
        </TestWrapper>
      );

      // Check for the SVG icon by its aria-hidden attribute and class
      const icon = document.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('tabler-icon-corner-down-right');
    });

    it('should render with proper Mantine styling classes', () => {
      render(
        <TestWrapper>
          <SelectedTextSent content='Test content' />
        </TestWrapper>
      );

      const group = screen.getByRole('complementary');
      expect(group).toBeInTheDocument();
    });

    it('should mark icon as decorative with aria-hidden', () => {
      render(
        <TestWrapper>
          <SelectedTextSent content='Test content' />
        </TestWrapper>
      );

      const icon = document.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('error handling', () => {
    it('should return null for empty string content', () => {
      const { container } = render(
        <TestWrapper>
          <SelectedTextSent content='' />
        </TestWrapper>
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('content variations', () => {
    it('should handle long content', () => {
      const longContent = 'This is a very long piece of selected text that should still render properly and maintain all accessibility features and styling';

      render(
        <TestWrapper>
          <SelectedTextSent content={longContent} />
        </TestWrapper>
      );

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should handle special characters and HTML entities', () => {
      const specialContent = 'Text with <tags> & "quotes" & symbols!';

      render(
        <TestWrapper>
          <SelectedTextSent content={specialContent} />
        </TestWrapper>
      );

      expect(screen.getByText(specialContent)).toBeInTheDocument();
    });

    it('should handle content with line breaks', () => {
      const multilineContent = 'Line one\nLine two\nLine three';

      render(
        <TestWrapper>
          <SelectedTextSent content={multilineContent} />
        </TestWrapper>
      );

      // Use getAllByText and find the span element specifically
      const elements = screen.getAllByText((content, element) => {
        return element?.textContent === multilineContent && element?.tagName === 'SPAN';
      });
      expect(elements[0]).toBeInTheDocument();
    });
  });
});
