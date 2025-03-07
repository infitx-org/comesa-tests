const fs = require("fs");
const AllureReportGenerator = require("./lib/allureReportGenerator");


// Read and parse the TTK report JSON
const ttkReport1 = JSON.parse(fs.readFileSync('test_ttk_report1.json', "utf8"));
const ttkReport2 = JSON.parse(fs.readFileSync('test_ttk_report2.json', "utf8"));

// Generate the Allure results for report 1
const reportGenerator1 = new AllureReportGenerator(ttkReport1);
reportGenerator1.generateAllureResults();

// Generate the Allure results for report 2 in append mode
const reportGenerator2 = new AllureReportGenerator(ttkReport2, true);
reportGenerator2.generateAllureResults();

// Generate the combined Allure report
AllureReportGenerator.generateAllureReport();

// Report will be generated in the allure-report directory
// Open the index.html file in the allure-report directory to view the report