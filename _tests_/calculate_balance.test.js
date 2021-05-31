const balance = require('../src/lib/calculate_balance');

test('correct balance is calculated', () => {
  expect(balance.calculate_balance(100,50,"Einnahme","C")).toBe(150);
  expect(balance.calculate_balance(100,50,"Ausgabe","C")).toBe(50);
  expect(balance.calculate_balance(100,50,"Steuer","C")).toBe(100);
  expect(balance.calculate_balance(100,50,"Privat","C")).toBe(50);
   expect(balance.calculate_balance(100,50,"Einnahme","D")).toBe(50);
    expect(balance.calculate_balance(100,50,"Ausgabe","D")).toBe(150);
    expect(balance.calculate_balance(100,50,"Steuer","D")).toBe(100);
    expect(balance.calculate_balance(100,50,"Privat","D")).toBe(150);
});