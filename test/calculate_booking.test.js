//const balance = require('../src/lib/calculate_balance');
import  {calculate_booking} from '../src/lib/calculate_booking.js';

test('correct booking is calculated', () => {
  expect(calculate_booking(100,19,"Einnahme")).toEqual({amount_netto: 84.03361344537815, amount_tax: 15.966386554621847, delta_amount: 84.03361344537815});
 expect(calculate_booking(100,19,"Ausgabe")).toEqual({amount_netto: 84.03361344537815, amount_tax: 15.966386554621847, delta_amount: 84.03361344537815});
 expect(calculate_booking(100,0,"Steuer")).toEqual({amount_netto: 100, amount_tax: 100, delta_amount: 0});
 expect(calculate_booking(100,0,"Privat")).toEqual({amount_netto: 100, amount_tax: 0, delta_amount: 100});

});