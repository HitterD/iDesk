import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequiredFieldsBuilder } from '../catalog/RequiredFieldsBuilder';
test('add field appends entry and calls onChange', () => {
  const onChange = vi.fn();
  render(<RequiredFieldsBuilder value={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /tambah field/i }));
  fireEvent.change(screen.getAllByLabelText(/field key/i)[0], { target: { value: 'brand' } });
  fireEvent.change(screen.getAllByLabelText(/label/i)[0], { target: { value: 'Brand' } });
  expect(onChange).toHaveBeenLastCalledWith([{ key: 'brand', label: 'Brand', type: 'string', required: true }]);
});
