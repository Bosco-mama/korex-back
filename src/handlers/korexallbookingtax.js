const AWS = require("aws-sdk");
const RDS = new AWS.RDSDataService();
import createError from "http-errors";
import date from "date-and-time";

import { get_db_params } from "../lib/get_db_params.js";
import { map_db_response } from "../lib/map_db_response.js";

exports.send = async function (event, context) {
  console.log(event);

  async function sleep(msec) {
    return new Promise((res) => {
      setTimeout(() => {
        res();
      }, msec);
    });
  }

  async function db_action(params, counter) {
    try {
      console.log("in DB");
      var result = await RDS.executeStatement(params).promise();
      return result;
      //       JSON.stringify(result, null, 2);
    } catch (err) {
      // Handle error
      console.error(JSON.stringify(err));
      console.log(err.message);
      console.log(err.message.slice(0, 26));
      if (err.message.slice(0, 27) == "Communications link failure") {
        console.log("db schläft, warte", counter);
        //schlafen für 5 sec
        await sleep(5000);
        // höchstens 5 mal versuchen
        return "SLEEPING";
        //          save_to_db(params, counter++);
      }
    }
  }
  try {
    let date_from = event.pathParameters.date_from;
    let date_to = event.pathParameters.date_to;

    //counter is for the sleeping DB, max retry 5
    let counter = 0;
    // if no date_from or date_to is specified, default values are used
    let currentDate = new Date();
    if (date_from == 0) {
      date_from = "01-01-2018 00:00:00";
    } else {
      date_from = date_from + " 00:00:00";
    }
    if (date_to == 0) {
      date_to = date.format(currentDate, "YYYY-MM-DD HH:mm:ss");
    } else {
      date_to = date_to + " 00:00:00";
    }

    let SQL_total_TAX = `select t.booking_type, sum(t.amount) from korex.booking_tax t where   str_to_date(t.booking_day, '%d.%m.%Y') >= "${date_from}" and str_to_date(t.booking_day, '%d.%m.%Y') <= "${date_to}"  group by t.booking_type  order by t.booking_type;`;

    // select the total amount of tax values in the corresponding time range
    //   let SQL_total_TAX = `select sum(t.amount) from korex.booking b, korex.booking_tax t where t.booking_id=b.booking_id and t.booking_type='Ausgabe' and str_to_date(b.booking_day, '%d.%m.%Y') > "${date_from}" and str_to_date(b.booking_day, '%d.%m.%Y') < "${date_to}" union select sum(t.amount) from korex.booking b, korex.booking_tax t where t.booking_id=b.booking_id and t.booking_type='Einnahme' and str_to_date(b.booking_day, '%d.%m.%Y') > "${date_from}" and str_to_date(b.booking_day, '%d.%m.%Y') < "${date_to}" union select sum(amount) from korex.booking_tax where booking_type='Steuer' and timestampcreated between "${date_from}"  and "${date_to}" `;
    let params_TAX = get_db_params(SQL_total_TAX);

    let select_TAX_response = await db_action(params_TAX, counter);

    // console.log(select_balance_response + "counter" + counter);

    while (select_TAX_response == "SLEEPING" && counter < 5) {
      select_TAX_response = await db_action(params_TAX, counter++);
    }

    console.log("TAX RESPONCE IS EQUAL ", JSON.stringify(select_TAX_response));

    let cols_amount = ["Amount_Type", "Amount"];
    let amounts = map_db_response(cols_amount, select_TAX_response);
    console.log("amounts", amounts);
    const TAX_response = {};
    let total_tax_out = amounts.find((obj) => {
      return obj.Amount_Type === "Ausgabe";
    });
    if (total_tax_out != null) {
      TAX_response.total_tax_output = Number(total_tax_out.Amount).toFixed(2);
    } else {
      TAX_response.total_tax_output = 0;
    }

    let total_tax_in = amounts.find((obj) => {
      return obj.Amount_Type === "Einnahme";
    });
    if (total_tax_in != null) {
      TAX_response.total_tax_input = Number(total_tax_in.Amount).toFixed(2);
    } else {
      TAX_response.total_tax_in = 0;
    }

    let total_tax_paid = amounts.find((obj) => {
      return obj.Amount_Type === "Steuer";
    });
    if (total_tax_paid != null) {
      TAX_response.total_tax_paid = Number(total_tax_paid.Amount).toFixed(2);
    } else {
      TAX_response.total_tax_paid = 0;
    }
    console.log(TAX_response);
    // select the corresponding bookings for the tax bookings
    let SQL_booking_TAX = `select b.booking_id, t.booking_text, t.booking_type, t.amount, t.tax_rate, t.booking_day,t.timestampcreated \
 from korex.booking b right join korex.booking_tax t on t.booking_id=b.booking_id where \
  ( str_to_date(t.booking_day, '%d.%m.%Y') >= "${date_from}" and str_to_date(t.booking_day, '%d.%m.%Y') <= "${date_to}") `;

    let params_booking_TAX = get_db_params(SQL_booking_TAX);

    let booking_TAX_response = await db_action(params_booking_TAX, counter);
    //Expected columns
    let cols = [
      "booking_id",
      "booking_text",
      "booking_type",
      "amount",
      "tax_rate",
      "booking_day",
      "timestampcreated",
    ];

    // Array of all bookings
    let bookings = map_db_response(cols, booking_TAX_response);
    console.log(bookings);
    TAX_response.booking = bookings;
    const http_response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Or use wildard * for testing
      },

      body: JSON.stringify(TAX_response, function (key, value) {
        if (
          key == "total_tax_output" ||
          key == "total_tax_input" ||
          key == "total_tax_paid"
        ) {
          return parseFloat(value);
        } else {
          return value;
        }
      }),
    };
    console.log("HTTP", http_response);
    return http_response;
  } catch (err) {
    // Handle error
    console.error(err);
    throw new createError.BadRequest(err);
  }
};
