const AWS = require("aws-sdk");
const RDS = new AWS.RDSDataService();
import createError from "http-errors";
import { v4 as uuid } from "uuid";
import date from "date-and-time";
import { determine_null } from "../lib/determine_null.js";
import { calculate_booking } from "../lib/calculate_booking.js";
import { calculate_balance } from "../lib/calculate_balance.js";
import { get_db_params } from "../lib/get_db_params.js";

var ergebnis, old_amount, new_amount, delta_amount, counter;

exports.save = async function (event, context) {
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
    // get the data from event
    const requestBody = JSON.parse(event.body);
    let booking_account = requestBody.booking_account;
    let booking_day = requestBody.booking_day;
    let tax_rate = parseInt(requestBody.tax_rate_number);
    let booking_type = requestBody.booking_type;
    let amount = parseInt(requestBody.amount);
    let booking_text = requestBody.booking_text;
    let currentDate = new Date();
    let TimestampCreated = date.format(currentDate, "YYYY/MM/DD HH:mm:ss");
    //validation
    if (
      booking_account == null ||
      booking_day == null ||
      booking_type == null ||
      amount == null ||
      booking_text == null ||
      tax_rate == null
    ) {
      console.error("Validation error");
      http_response = {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*", // Or use wildard * for testing
        },
        body: JSON.stringify({
          message: "Validation error.",
        }),
      };
      return http_response;
    }

    //get the current balance
    let sqlStatement_stand =
      "select amount from korex.water_stand where booking_account= :booking_account;";
    let sqlParameter_stand = [
      { name: "booking_account", value: { stringValue: booking_account } },
    ];
    let params_stand = get_db_params(sqlStatement_stand, sqlParameter_stand);

    //the serverless DB is sleeping
    counter = 0;
    let ergebnis = "SLEEPING";
    while (ergebnis == "SLEEPING" && counter < 5) {
      ergebnis = await db_action(params_stand, counter++);
    }
    let select_response = ergebnis;
    let amount_obj = select_response.records[0][0];
    old_amount = parseInt(Object.values(amount_obj)[0]);

    //calculate amounts for booking
     let amount_booking = calculate_booking(amount, tax_rate, booking_type);
    //calculate new balance , operation is create
    let operation = "C";
    let new_balance = calculate_balance(
      old_amount,
      parseInt(amount_booking.delta_amount),
      booking_type,
      operation
    );

    new_balance = parseInt(new_balance);
    console.log(new_balance, "new balance");
    //start transaction

    let params_trans = {
      resourceArn: process.env.DB_AURORACLUSTER_ARN,
      secretArn: process.env.DB_SECRETSTORE_ARN,
      database: process.env.DB_NAME,
      schema: "korex",
    };

    let transaction_id = await RDS.beginTransaction(params_trans).promise();
    let trans_id = Object.values(transaction_id)[0];
    let uuid_booking = uuid();
    //for E,A,P input, output, private
    if (
      booking_type == "Einnahme" ||
      booking_type == "Ausgabe" ||
      booking_type == "Privat"
    ) {
      //save booking

      // insert into booking
      let sqlStatement_insertBooking =
        "insert into korex.booking (booking_id, booking_account, booking_day, amount, booking_text, booking_type,timestampcreated) values (:booking_id, :booking_account, :booking_day, :amount, :booking_text, :booking_type,  :timestampcreated);";

      let sqlParameter_booking = [
        { name: "booking_id", value: { stringValue: uuid_booking } },
        { name: "booking_account", value: { stringValue: booking_account } },
        { name: "booking_day", value: { stringValue: booking_day } },
        {
          name: "amount",
          value: {
            doubleValue: parseInt(amount_booking.amount_netto),
          },
        },
        { name: "booking_text", value: { stringValue: booking_text } },
        { name: "booking_type", value: { stringValue: booking_type } },
        { name: "timestampcreated", value: { stringValue: TimestampCreated } },
      ];

      let params_booking = get_db_params(
        sqlStatement_insertBooking,
        sqlParameter_booking
      );
      let insert_booking_response = await db_action(params_booking, counter);

      //save new water_stand
      let sqlStatement_balance =
        "update korex.water_stand set amount = :new_amountsql where booking_account= :booking_account;";
      let sqlParameter_balance = [
        {
          name: "booking_account",
          value: { stringValue: booking_account },
        },
        { name: "new_amountsql", value: { doubleValue: new_balance } },
      ];

      let params_balance = get_db_params(
        sqlStatement_balance,
        sqlParameter_balance
      );

      //save water_stand_history
      let balance_response = await db_action(params_balance, counter);

      //history of water stand
      let sqlStatement_history =
        "insert into korex.water_stand_history (water_stand_history_id, booking_account,  amount , timestampcreated, booking_id, booking_operation) values (:water_stand_history_id, :booking_account,  :amount , :timestampcreated, :booking_id, :booking_operation);";
      let uuid_water_stand_history = uuid();
      let sqlParameter_history = [
        {
          name: "water_stand_history_id",
          value: { stringValue: uuid_water_stand_history },
        },
        { name: "booking_account", value: { stringValue: booking_account } },
        { name: "amount", value: { doubleValue: new_balance } },
        { name: "timestampcreated", value: { stringValue: TimestampCreated } },
        { name: "booking_id", value: { stringValue: uuid_booking } },
        { name: "booking_operation", value: { stringValue: operation } },
      ];

      let params_history = get_db_params(
        sqlStatement_history,
        sqlParameter_history
      );

      let insert_history = await db_action(params_history, counter);
    }

    // for E,A,T input, output, tax save booking_tax
    if (
      booking_type == "Einnahme" ||
      booking_type == "Ausgabe" ||
      booking_type == "Steuer"
    ) {
      let sqlStatement_insert_tax =
        "insert into korex.booking_tax (id,booking_id, amount, tax_rate, booking_type, timestampcreated) values (:id, :booking_id, :amount, :tax_rate, :booking_type, :timestampcreated);";
      let uuid_booking_tax = uuid();
      let sqlParameter_tax = [
        { name: "id", value: { stringValue: uuid_booking_tax } },
        { name: "booking_id", value: { stringValue: uuid_booking } },
        { name: "amount", value: { doubleValue: amount_booking.amount_tax } },
        { name: "tax_rate", value: { longValue: tax_rate } },
        { name: "booking_type", value: { stringValue: booking_type } },
        { name: "timestampcreated", value: { stringValue: TimestampCreated } },
      ];
      let params_insert_tax = get_db_params(
        sqlStatement_insert_tax,
        sqlParameter_tax
      );

      let insert_tax_response = await db_action(
        params_insert_tax,
        counter,
        sqlParameter_tax
      );
    }

    // commit transaction
    let params_trans_commit_rollback = {
      resourceArn: process.env.DB_AURORACLUSTER_ARN,
      secretArn: process.env.DB_SECRETSTORE_ARN,
      transactionId: trans_id,
    };
     let transaction_status_com = await RDS.commitTransaction(
      params_trans_commit_rollback
    ).promise();

    //http response
    const http_response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Or use wildard * for testing
      },
      body: JSON.stringify({
        message: "Booking successfully saved.",
        booking_id: uuid_booking,
      }),
    };
    console.log(http_response);
    return http_response;
  } catch (err) {
    // Handle error
    console.error(err);
    //rollback
    if (transaction_id) {
      let params_rollback = {
        resourceArn: process.env.DB_AURORACLUSTER_ARN /* required */,
        secretArn: process.env.DB_SECRETSTORE_ARN /* required */,
        transactionId: trans_id /* required */,
      };
      let transaction_status_roll = await RDS.rollbackTransaction(
        params_trans_commit_rollback
      ).promise();
      console.log(transaction_status_roll, "trans_status");
    }
    http_response = {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*", // Or use wildard * for testing
      },
      body: JSON.stringify({
        message: "Default error in the procesing. " + err,
      }),
    };
  }
};
