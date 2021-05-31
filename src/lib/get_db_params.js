export function get_db_params(sqlStatement, sqlParameter) {
  let db_params = {
    secretArn: process.env.DB_SECRETSTORE_ARN,
    resourceArn: process.env.DB_AURORACLUSTER_ARN,
    sql: sqlStatement,
    parameters: sqlParameter,
    database: process.env.DB_NAME,
  };
  return db_params;
}
