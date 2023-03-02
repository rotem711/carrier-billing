import XLSX from "xlsx";
import fs from "fs";
import { stringify } from "csv-stringify";
import { accounts } from "./accounts.js";
import uspsRates from "./rates/json/usps.json" assert { type: "json" };
import exampleCustomerRates from "./rates/json/example-customer.json" assert { type: "json" };
const JSON_PATH = "rates/json";
const XLSX_PATH = "billing";

const calcDimWeights = (row) => {
  const { Height, Length, Width } = row;

  const cubicVolume = Length * Height * Width;
  const dimWt166 = Math.ceil(cubicVolume / 166);
  const dimWt196 = Math.ceil(cubicVolume / 196);

  row.cubicVolume = cubicVolume;
  row.dimWt166 = dimWt166;
  row.dimWt196 = dimWt196;
};

const calcBillWeights = (row) => {
  const { cubicVolume, dimWt166, dimWt196 } = row;
  const billedWeight = row["Billed Weight"];
  const actualWeight = row["Actual Weight"];
  const billedService = row["Billed Service"];
  const cubicSize = Math.ceil((cubicVolume / 1728) * 10) / 10;
  const roundedWtLbs = Math.ceil(actualWeight);
  let roundedWtOz = Math.ceil(actualWeight * 16);

  row.roundedWtLbs = roundedWtLbs;
  row.roundedWtOz = roundedWtOz;
  row.billWt166 = billedWeight;
  row.billWt196 = billedWeight;
  row.billWtUSPS = billedWeight;
  row.cubicSize = cubicSize;

  if (billedService === "Parcel") {
    const billWt166 = roundedWtLbs > dimWt166 ? roundedWtLbs : dimWt166;
    const billWt196 = roundedWtLbs > dimWt196 ? roundedWtLbs : dimWt196;
    const billWtUSPS = cubicSize > 1 ? billWt166 : roundedWtLbs;

    row.billWt166 = billWt166;
    row.billWt196 = billWt196;
    row.billWtUSPS = billWtUSPS;
  }

  if (billedService === "Small Parcel") {
    if (roundedWtOz === 16) {
      roundedWtOz = 15.99;
    }

    row.billWt166 = roundedWtOz;
    row.billWt196 = roundedWtOz;
    row.billWtUSPS = roundedWtOz;
  }
};

const calculateCustomerRates = (row) => {
  // accounts
  const packageCharge = row["Package Charge"];
  const customerName = row["Cost Center Name"];
  const { pricingMethod, billWtMethod, markups, lookupObject, das } =
    accounts[customerName];
  row.customerBillWt = row[billWtMethod];
  // confirm how to get markup factor if pricingMethod is markup
  if (pricingMethod === "lookup") {
    // "lookup" in a rateObject
    const zone = row["Zone"];
    const billWt = row["billWtMethod"];
    const parcel = row["Billed Service"];
    row.customerPackageCharge = packageCharge * uspsRates[parcel][billWt][zone];
  } else {
    if (row["Billed Service"] === "Parcel") {
      row.customerPackageCharge = packageCharge * markups.parcelMarkup;
    } else if (row["Billed Service"] === "Small Parcel") {
      row.customerPackageCharge = packageCharge * markups.smallParcelMarkup;
    } else {
      row.customerPackageCharge = packageCharge;
    }
  }
  row.customerFuel = row.customerPackageCharge * (markups.fuel.fuelSurcharge === 'MARKET' ? 0.1025 : 0.08 )
  row.customerDas = das
  row.packageMargin = 0
  row.fuelMargin = 0
  row.dasMargin = 0
  row.totalMargin = row.packageMargin + row.fuelMargin + row.dasMargin
  console.log(accounts[customerName]);
};

const calculateUSPSRates = (row) => {
  const { uspsbillwt } = row;
  const zone = row["Zone"];
  const uspsFCPSrate = usps.json["fcps-cpp"][uspsbillwt][zone];
  const uspsPriorityRate = usps.json["priority-cpp"][uspsbillwt][zone];
  const uspsParcelSelectRate = usps.json["parcel-select"][uspsbillwt][zone];

  row.uspsFCPSrate = uspsFCPSrate;
  row.uspsPriorityRate = uspsPriorityRate;
  row.uspsParcelSelectRate = uspsParcelSelectRate;
};

const calculate = (row) => {
  let newrow = Object.assign({}, row);
  calcDimWeights(newrow);
  calcBillWeights(newrow);
  calculateCustomerRates(newrow);
  calculateUSPSRates(newrow);
  return newrow;
};

const writeCSV = (filename, header, data) => {
  const writableStream = fs.createWriteStream(filename);

  const stringifier = stringify({ header: true, columns: header });
  data.map((row) => {
    stringifier.write(row);
  });
  stringifier.pipe(writableStream);
  console.log("Finished writing data");
};

const main = () => {
  var workbook = XLSX.readFile(`${XLSX_PATH}/Bluescreen 02.04.2023.xlsx`);
  var sheet_name_list = workbook.SheetNames;
  var xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

  let newrow = calculate(xlData[0]);

  // xlData.map((row) => {
  //   let newrow = calculate(row)
  // });

  const transactionReportAllHeaders = [
    "Carrier BOL",
    "Package Id",
    "Tracking ID",
    "Processed Date/Time",
    "Actual Weight",
    "Billed Weight",
    "Billed Service",
    "Zip",
    "Zone",
    "Package Charge",
    "Delivery Confirmation Charge",
    "Fuel Charge",
    "MISC Surcharge",
    "Carrier DIM Surcharge",
    "Total Charge",
    "Height",
    "Length",
    "Width",
    "Cost Center Name",
    "DIM Rules Applied",
    "Relabel Fee",
    "Delivery Area Surcharge (DAS)",
    "OCR Fee",
    "Peak Season Surcharge",
    "Nonstandard Length Fee 22 in",
    "Nonstandard Length Fee 30 in",
    "Nonstandard Length Fee 2 cu",
    "Dimension Noncompliance",
    "Irregular Shape Charge",
    "roundedWtLbs",
    "roundedWtOz",
    "dimWt166",
    "dimWt196",
    "billWt166",
    "billWt196",
    "uspsBillWt",
    "cubicVolume",
    "cubicSize",
    "customerBillWt",
    "customerPackageCharge",
    "customer Fuel",
    "customer Das",
    "packageMargin",
    "fuelMargin",
    "dasMargin",
    "totalMargin",
    "uspsFCPSrate",
    "uspsPriorityRate",
    "uspsParcelSelectRate",
  ];

  // const testdata = new Array(5).fill(new Array(49).fill(4))

  // writeCSV(
  //   "transaction-report_all-accounts.csv",
  //   transactionReportAllHeaders,
  //   testdata
  // );
};

main();
