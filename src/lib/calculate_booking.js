export function calculate_booking(amount, tax_rate, booking_type) {
  let amount_netto = amount;
  let amount_tax = 0;
  let delta_amount = 0;

  //falls es sich um Einnahme oder Ausgabe handelt und Steuersatz gefüllt ist
  if (
    tax_rate > 0 &&
    (booking_type == "Ausgabe" || booking_type == "Einnahme")
  ) {
    amount_tax = amount * (tax_rate / (tax_rate + 100));
    amount_netto = amount * (100 / (tax_rate + 100));
    delta_amount = Math.abs(amount_netto);
  }
  //Die Zahlungen an die Steuerkasse werden nur in der Steuertabelle gespeichert
  else if (booking_type == "Steuer") {
    amount_tax = amount_netto;
    delta_amount = 0;
  }
  //Die Zahlungen an die Steuerkasse werden nur in der Steuertabelle gespeichert
  else if (booking_type == "Privat") {
    delta_amount = amount_netto;
  }
  let amount_booking = {
    amount_netto: amount_netto,
    amount_tax: amount_tax,
    delta_amount: delta_amount,
  };
  return amount_booking;
}
