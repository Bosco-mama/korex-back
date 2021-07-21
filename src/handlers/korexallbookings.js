const AWS = require("aws-sdk");
const RDS = new AWS.RDSDataService();
import createError from "http-errors";
import { map_db_response } from "../lib/map_db_response.js";
import { get_db_params } from "../lib/get_db_params.js";

exports.send = async function (event, context) {
  console.log(event);

  const booking_account = event.pathParameters.booking_account;

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
      }
    }
  }
  try {
    //counter is for the sleeping DB, max retry 5
    let counter = 0;
    const booking_response = {};
    // Select the Project, Balance for account and for 'gemeinschaft'
    let sqlStatement_balance =
      "select s.project, w1.amount, w2.amount from korex.water_stand w1, korex.water_stand w2, korex.shareholder s where w1.booking_account=:booking_account and w2.booking_account=:booking_gem and s.shareholder_id=:booking_account;";
    let sqlParameter_balance = [
      { name: "booking_account", value: { stringValue: booking_account } },
      { name: "booking_gem", value: { stringValue: "gemeinschaft" } },
    ];

    let params_balance = get_db_params(
      sqlStatement_balance,
      sqlParameter_balance
    );

    let select_balance_response = await db_action(params_balance, counter);

    console.log(select_balance_response + "counter" + counter);

    while (select_balance_response == "SLEEPING" && counter < 4) {
      select_balance_response = await db_action(params_balance, counter);
    }

    let shareholder_project_obj = select_balance_response.records[0][0];
    let balance_raw_obj = select_balance_response.records[0][1];
    let balance_gem_obj = select_balance_response.records[0][2];
    let balance_raw = Object.values(balance_raw_obj)[0];
    // balance from gemeinschaft will be splitted to all 4 accounts
    let balance_update = balance_raw + Object.values(balance_gem_obj)[0] / 4;
    //for the account gemeintschaft, there is no balance_update

    if (booking_account == "gemeinschaft") {
      balance_update = 0;
    }
    let shareholder_project = Object.values(shareholder_project_obj)[0];
    // select all bookings for account
    let sqlStatement_booking =
      "select b.booking_id,b.booking_day,b.amount,b.booking_text,b.booking_type, h.amount as amount_history  from korex.booking b left outer join korex.water_stand_history h on h.booking_id=b.booking_id where b.booking_account=:booking_account order by str_to_date(b.booking_day, '%d.%m.%Y') desc;";
    let sqlParameter_booking = [
      { name: "booking_account", value: { stringValue: booking_account } },
    ];
    let params_booking = get_db_params(
      sqlStatement_booking,
      sqlParameter_booking
    );

    let select_booking_response = await db_action(params_booking, counter);

    // Array of all bookings
    let bookings = new Array();

    //expected columns
    let cols = [
      "booking_id",
      "booking_day",
      "amount_netto",
      "booking_text",
      "booking_type",
      "amount_history",
    ];

    let booking_list = map_db_response(cols, select_booking_response);

    //Put the balance data to response

    booking_response.booking_account = booking_account;
    booking_response.project = shareholder_project;
    booking_response.balance_raw = Number(balance_raw).toFixed(2);
    booking_response.balance_updated = Number(balance_update).toFixed(2);
    booking_response.booking = booking_list;
    // console.log(JSON.stringify(booking_response), "BOOKINGS");
    const http_response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Or use wildard * for testing
      },
      //body: JSON.stringify(booking_response)
      body: JSON.stringify(booking_response, function (key, value) {
        if (
          key == "balance_raw" ||
          key == "balance_updated" ||
          key == "amount_netto"
        ) {
          return parseFloat(value);
        } else {
          return value;
        }
      }),
    };
    return http_response;
  } catch (err) {
    // Handle error
    console.error(err);
    throw new createError.BadRequest(err);
  }
};
