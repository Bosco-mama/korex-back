# korex-back
Node JS backend application in Serverless Framework

POST 
.../createbooking
{"booking_account" : "bagher",
"booking_day": "23.04.2021",
"amount": 500.00 ,
"tax_rate_number":19,
"booking_text": "Testbuchung Einnahme" ,
"booking_type": "Privatentnahme" }

GET
.../bookings/{booking_account}

DELETE
.../deletebooking/{variationUUID}

UPDATE Project
.../shareholder/{shareholder}
shareholer=booking_account

JSON
{
project: VARCHAR}
new Project for the shareholder

TAX - GET
.../tax/{date_from}/{date_to}
Date Format: 2021-01-01/2021-08-01
if date_from or date_to not specified, 0 is required:
.../tax/0/0
Return JSON
{
    "total_tax_output": 976.98,
    "total_tax_input": 4151.26,
    "total_tax_paid": 551010,
     [{
                "booking_id": null,
                "booking_text": null,
                "booking_type": "Steuer",
                "amount": 5000,
                "booking_day": null,
                "timestampcreated": "2021-07-13 13:17:27"
            },
             {
                 "booking_id": "56fd4b9a-4586-402f-ab39-dbd6f7e6b7d7",
                  "booking_text": "test",
                  "booking_type": "Einnahme",
                  "amount": 1900,
                  "tax_rate": 19,
                  "booking_day": "11.12.2020",
                  "timestampcreated": "2021-07-20 11:17:29"
                    }]
}