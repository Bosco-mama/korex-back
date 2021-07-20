const AWS = require("aws-sdk");
const RDS = new AWS.RDSDataService();
import createError from "http-errors";
import { v4 as uuid } from "uuid";
import date from "date-and-time";

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
    let project = requestBody.project;
    const shareholder = event.pathParameters.shareholder;

    //get the current balance
    let sqlStatement_stand = `UPDATE korex.shareholder SET project = "${project}" WHERE shareholder_id= "${shareholder}";`;
    let params_stand = get_db_params(sqlStatement_stand);

    //checking if the request has a valid project
    if (!project) {
      throw new createError.NotFound(`project "${project}" not found!`);
      {
        console.error("request error project not found");
        http_response = {
          statusCode: 400,
          headers: {
            "request error project not found": "*", // Or use wildard * for testing
          },
          body: JSON.stringify({
            message: "request error project not found",
          }),
        };
        return http_response;
      }
    }
    //the serverless DB is sleeping
    counter = 0;
    let ergebnis = "SLEEPING";
    while (ergebnis == "SLEEPING" && counter < 5) {
      ergebnis = await db_action(params_stand, counter++);
      console.log(
        "numberOfRecordsUpdated ist",
        JSON.stringify(ergebnis.numberOfRecordsUpdated)
      );
      //console.log("ergebnis ist", JSON.stringify(ergebnis);
    }

    //check if Shareholder valid by checking if numberOfRecordsUpdated is 0 or 1
    if (JSON.stringify(ergebnis.numberOfRecordsUpdated) == 0) {
      throw new createError.NotFound(`Shareholder "${shareholder}" not found!`);
      {
        console.error("Shareholder not found");
        http_response = {
          statusCode: 400,
          headers: {
            "Shareholder not found": "*", // Or use wildard * for testing
          },
          body: JSON.stringify({
            message: "Shareholder not found",
          }),
        };
        return http_response;
      }
    }

    const http_response = {
      statusCode: 201,
      headers: {
        "Access-Control-Allow-Origin": "*", // Or use wildard * for testing
      },
      body: JSON.stringify({
        message: "Project successfully updated.",
      }),
    };
    console.log(http_response);
    return http_response;
  } catch (err) {
    // Handle error
    console.error(err);
    //rollback

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
