export function calculate_balance(old_amount,delta_amount,booking_type,operation)  {

  //operation c= create, d=delete
  // Einnahme wird bei create +
  //Einnahme wird bei delete -
  //Ausgabe/Privatentnahme wird bei create -
  //Ausgabe/Privatentnahme wird bei delete +

  var new_amount = 0.0;
  if (
    ((booking_type == "Ausgabe" || booking_type == "Privat") &&
      operation == "C") ||
    (booking_type == "Einnahme" && operation == "D")
  ) {
    new_amount = old_amount - delta_amount;
  }
  //oder Einnahme
  else if (
    (booking_type == "Einnahme" && operation == "C") ||
    ((booking_type == "Ausgabe" || booking_type == "Privat") &&
      operation == "D")
  ) {
    new_amount = old_amount + delta_amount;
  } else {
    new_amount = old_amount;
  }

  return new_amount;
}

