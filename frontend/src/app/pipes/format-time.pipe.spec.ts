import { FormatTimePipe } from './format-time.pipe';

describe('FormatTimePipe', () => {
  const pipe = new FormatTimePipe();

  it('formats whole minutes and seconds as m:ss', () => {
    expect(pipe.transform(65)).toBe('1:05');
    expect(pipe.transform(600)).toBe('10:00');
  });

  it('pads single-digit seconds with a zero', () => {
    expect(pipe.transform(9)).toBe('0:09');
  });

  it('truncates fractional seconds instead of rounding up', () => {
    expect(pipe.transform(59.99)).toBe('0:59');
    expect(pipe.transform(125.3)).toBe('2:05');
  });

  it('keeps counting minutes past one hour', () => {
    expect(pipe.transform(3725)).toBe('62:05');
  });

  it('renders 0:00 for zero, negative and non-finite input', () => {
    expect(pipe.transform(0)).toBe('0:00');
    expect(pipe.transform(-5)).toBe('0:00');
    expect(pipe.transform(NaN)).toBe('0:00');
    expect(pipe.transform(Infinity)).toBe('0:00');
  });

  it('renders 0:00 for missing values', () => {
    expect(pipe.transform(null)).toBe('0:00');
    expect(pipe.transform(undefined)).toBe('0:00');
  });
});
