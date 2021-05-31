const AWS = require("aws-sdk");
const RDS = new AWS.RDSDataService();
import createError from "http-errors";

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
        //          save_to_db(params, counter++);
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

    let params_balance = {
      secretArn: process.env.DB_SECRETSTORE_ARN,
      resourceArn: process.env.DB_AURORACLUSTER_ARN,
      sql: sqlStatement_balance,
      parameters: sqlParameter_balance,
      database: process.env.DB_NAME,
    };

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
    let shareholder_project = Object.values(shareholder_project_obj)[0];
    // select all bookings for account
    let sqlStatement_booking =
      "select b.booking_id,b.booking_day,b.amount,b.booking_text,b.booking_type, h.amount as amount_history  from korex.booking b left outer join korex.water_stand_history h on h.booking_id=b.booking_id where b.booking_account=:booking_account order by str_to_date(b.booking_day, '%d.%m.%Y') desc;";
    let sqlParameter_booking = [
      { name: "booking_account", value: { stringValue: booking_account } },
    ];
    let params_booking = {
      secretArn: process.env.DB_SECRETSTORE_ARN,
      resourceArn: process.env.DB_AURORACLUSTER_ARN,
      sql: sqlStatement_booking,
      parameters: sqlParameter_booking,
      database: process.env.DB_NAME,
    };
    console.log(params_booking);
    let select_booking_response = await db_action(params_booking, counter);

    // Array of all bookings
    let bookings = new Array();

    let booking_list = select_booking_response.records;

    //loop über bookings
    //let one_booking = new Array();
    booking_list.forEach((one_booking) => {
      let booking_obj = {};

      let booking_id_obj = one_booking[0];
      booking_obj.booking_id = Object.values(booking_id_obj)[0];
      let booking_day_obj = one_booking[1];
      booking_obj.booking_day = Object.values(booking_day_obj)[0];
      let booking_amount_obj = one_booking[2];
      booking_obj.amount_netto = Number(
        Object.values(booking_amount_obj)[0]
      ).toFixed(2);
      let booking_text_obj = one_booking[3];
      booking_obj.booking_text = Object.values(booking_text_obj)[0];
      let booking_type_obj = one_booking[4];
      booking_obj.booking_type = Object.values(booking_type_obj)[0];
      let amount_history_obj = one_booking[5];
      booking_obj.amount_history = Object.values(amount_history_obj)[0];
      bookings.push(booking_obj);
    });
    console.log(bookings + "BOOKINGS");

    //Put the balance data to response

    booking_response.booking_account = booking_account;
    booking_response.project = shareholder_project;
    booking_response.balance_raw = Number(balance_raw).toFixed(2);
    booking_response.balance_updated = Number(balance_update).toFixed(2);
    booking_response.booking = bookings;
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
