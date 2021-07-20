# korex-back
Node JS backend application in Serverless Framework

POST 
...test/createbooking
{"booking_account" : "bagher",
"booking_day": "23.04.2021",
"amount": 500.00 ,
"tax_rate_number":19,
"booking_text": "Testbuchung Einnahme" ,
"booking_type": "Privatentnahme" }

GET
...test/bookings/{booking_account}

DELETE
.../test/deletebooking/{variationUUID}
