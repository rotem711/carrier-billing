import csv from "csv-parser";
import glob from "glob";
import fs from "fs";
const CSV_PATH = "rates/csvs";
const JSON_PATH = "rates/json";
const options = {};

/* writeJSON */
/* check if company-name.json exists and rewrite data */
const writeJSON = async (companyName, service, payload) => {
  return new Promise((resolve) => {
    return fs.readFile(
      `${JSON_PATH}/${companyName}.json`,
      async (err, data) => {
        let jsonData = {};
        if (err) {
          jsonData = {};
        } else {
          jsonData = JSON.parse(data);
        }
        jsonData[service] = payload;
        await fs.writeFileSync(
          `${JSON_PATH}/${companyName}.json`,
          JSON.stringify(jsonData)
        );
        resolve();
      }
    );
  });
};

/* readCSV */
/* read file, and generate data for service */
const readCSV = async (filepath, companyName, service) => {
  return new Promise((resolve) => {
    const results = {};
    return fs
      .createReadStream(filepath)
      .pipe(csv())
      .on("data", (data) => {
        // preparing zone data
        const zoneKey = Object.keys(data).filter(
          (item) => item.indexOf("wt") > -1
        )[0];
        const zone = data[zoneKey];
        const zoneData = {};
        Object.keys(data).map((key) => {
          if (key != zoneKey) zoneData[key] = parseFloat(data[key]);
        });
        results[zone] = zoneData;
      })
      .on("end", async () => {
        await writeJSON(companyName, service, results);
        resolve();
      });
  });
};

const main = () => {
  // read all csv files in csv folder path
  glob(`${CSV_PATH}/*.csv`, options, async function (er, files) {
    for (let i = 0; i < files.length; i++) {
      const filepath = files[i];
      const filename = filepath.split("/").pop();
      const companyName = filename.split("_")[0];
      const service = filename.split("_").pop().split(".csv")[0];
      await readCSV(filepath, companyName, service);
    }
  });
};

main();
