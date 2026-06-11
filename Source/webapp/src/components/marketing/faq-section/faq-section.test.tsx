import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FaqSection } from './faq-section';

describe('FaqSection', () => {
  it('answer is hidden before the question is clicked', () => {
    render(<FaqSection />);
    expect(screen.queryByText(/RLS, encryption, EU hosting/i)).not.toBeInTheDocument();
  });

  it('reveals the answer when a question is clicked', async () => {
    render(<FaqSection />);
    await userEvent.click(screen.getByText(/Is my financial data safe/i));
    expect(screen.getByText(/RLS, encryption, EU hosting/i)).toBeInTheDocument();
  });

  it('hides the answer when the open question is clicked again', async () => {
    render(<FaqSection />);
    const question = screen.getByText(/Is my financial data safe/i);
    await userEvent.click(question);
    await userEvent.click(question);
    expect(screen.queryByText(/RLS, encryption, EU hosting/i)).not.toBeInTheDocument();
  });
});
