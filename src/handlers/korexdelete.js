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

exports.delete = async function (event, context) {
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
    // get the data from path variable
    const booking_uuid = event.pathParameters.booking_uuid;
    let currentDate = new Date();
    let TimestampCreated = date.format(currentDate, "YYYY/MM/DD HH:mm:ss");

    //validation
    if (booking_uuid == null) {
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
      "select ws.amount, bo1.amount,bo1.booking_type , bo1.booking_account from korex.water_stand ws, korex.booking bo1 where ws.booking_account=(select bo2.booking_account from korex.booking bo2 where  bo2.booking_id= :booking_uuid) and bo1.booking_id=:booking_uuid;";
    let sqlParameter_stand = [
      { name: "booking_uuid", value: { stringValue: booking_uuid } },
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
    let old_amount = parseInt(Object.values(amount_obj)[0]);
    let delta_obj = select_response.records[0][1];
    let delta_amount = parseInt(Object.values(delta_obj)[0]);
    let booking_type_obj = select_response.records[0][2];
    let booking_type = Object.values(booking_type_obj)[0];
    let booking_account_obj = select_response.records[0][3];
    let booking_account = Object.values(booking_account_obj)[0];

    //calculate new balance , operation is delete
    let operation = "D";
    let new_balance = calculate_balance(
      old_amount,
      delta_amount,
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

    if (
      booking_type == "Einnahme" ||
      booking_type == "Ausgabe" ||
      booking_type == "Privat"
    ) {
      // delete from booking
      let sqlStatement_insertBooking =
        "delete from korex.booking where booking_id=:booking_id;";

      let sqlParameter_booking = [
        { name: "booking_id", value: { stringValue: booking_uuid } },
      ];

      let params_booking = get_db_params(
        sqlStatement_insertBooking,
        sqlParameter_booking
      );
      let delete_booking_response = await db_action(params_booking, counter);

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
        { name: "booking_id", value: { stringValue: booking_uuid } },
        { name: "booking_operation", value: { stringValue: operation } },
      ];

      let params_history = get_db_params(
        sqlStatement_history,
        sqlParameter_history
      );

      let delete_history = await db_action(params_history, counter);
    }

    // for E,A,T input, output, tax save booking_tax
    if (
      booking_type == "Einnahme" ||
      booking_type == "Ausgabe" ||
      booking_type == "Steuer"
    ) {
      let sqlStatement_insert_tax =
        "delete from korex.booking_tax where booking_id=:booking_id;";

      let sqlParameter_tax = [
        { name: "booking_id", value: { stringValue: booking_uuid } },
      ];
      let params_insert_tax = get_db_params(
        sqlStatement_insert_tax,
        sqlParameter_tax
      );

      let delete_tax_response = await db_action(
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
        message: "Booking successfully deleted. New balance.",
        new_balance: new_balance,
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
