export function determine_null(field) {
  let obj_null = {};
  let key = "isNull";
  let value = true;
  obj_null[`${key}`] = value;
  let obj = {};
  key = "stringValue";
  value = field;
  obj[`${key}`] = value;
  obj = field === undefined ? obj_null : obj;
  return obj;
}
