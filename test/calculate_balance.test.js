//const balance = require('../src/lib/calculate_balance');
import  {calculate_balance} from '../src/lib/calculate_balance.js';

test('correct balance is calculated', () => {
  expect(calculate_balance(100,50,"Einnahme","C")).toBe(150);
  expect(calculate_balance(100,50,"Steuer","C")).toBe(100);
  expect(calculate_balance(100,50,"Ausgabe","C")).toBe(50);
  expect(calculate_balance(100,50,"Privat","C")).toBe(50);
   expect(calculate_balance(100,50,"Einnahme","D")).toBe(50);
    expect(calculate_balance(100,50,"Ausgabe","D")).toBe(150);
    expect(calculate_balance(100,50,"Steuer","D")).toBe(100);
    expect(calculate_balance(100,50,"Privat","D")).toBe(150);
});