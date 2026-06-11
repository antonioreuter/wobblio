import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PricingTable } from './pricing-table';

describe('PricingTable', () => {
  it('annual plan is selected by default', () => {
    render(<PricingTable />);
    expect(screen.getByRole('radio', { name: /annual/i })).toBeChecked();
  });

  it('switches to monthly when monthly is clicked', async () => {
    render(<PricingTable />);
    await userEvent.click(screen.getByRole('radio', { name: /monthly/i }));
    expect(screen.getByRole('radio', { name: /monthly/i })).toBeChecked();
  });

  it('shows the "2 months free" badge when annual is selected', () => {
    render(<PricingTable />);
    expect(screen.getByText(/2 months free/i)).toBeInTheDocument();
  });
});
