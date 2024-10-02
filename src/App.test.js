// src/App.test.js
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Body Weight Loss Simulator title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Body Weight Loss Simulator/i);
  expect(titleElement).toBeInTheDocument();
});
