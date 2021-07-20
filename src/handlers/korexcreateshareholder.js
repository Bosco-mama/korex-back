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

    //update the project in DB
    let sqlStatement_project = `UPDATE korex.shareholder SET project = "${project}" WHERE shareholder_id= "${shareholder}";`;
    let params_project = get_db_params(sqlStatement_stand);

    if (!project) {
      throw new createError.NotFound(`Shareholder "${shareholder}" not found!`);
      {
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
    }
    //the serverless DB is sleeping
    counter = 0;
    let ergebnis = "SLEEPING";
    while (ergebnis == "SLEEPING" && counter < 5) {
      ergebnis = await db_action(params_project, counter++);
      console.log('ergebnis db',JSON.stringify(ergebnis) );
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
