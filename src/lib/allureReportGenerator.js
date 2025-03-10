const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const allure = require("allure-commandline");
const ttkReportHelpers = require("./ttkReportHelpers");

const DEFAULT_RESULTS_DIR = "allure-results";
const DEFAULT_REPORT_DIR = "allure-report";

class AllureReportGenerator {
    constructor(options = {}) {
        this.ttkReport = options.ttkReport || {};
        this.ttkReport = options.ttkReportFile ? JSON.parse(fs.readFileSync(options.ttkReportFile, "utf8")) : {};
        this.suiteName = options.suiteName || this.ttkReport.name || "TTK Report";
        this.purge = options.purge || false;
        this.resultsDir = options.resultsDir || DEFAULT_RESULTS_DIR;
        this.reportDir = options.reportDir || DEFAULT_REPORT_DIR;
        this.ensureResultsDir();
    }

    ensureResultsDir() {
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        } else {
            if (this.purge) {
                fs.readdirSync(this.resultsDir).forEach((file) => {
                    fs.unlinkSync(path.join(this.resultsDir, file));
                });
            }
        }
    }

    generateAllureResults() {
        this.ttkReport.test_cases.forEach((testCase) => {
            const allureTest = this.createAllureTest(testCase);
            this.processRequests(testCase, allureTest);
            this.writeTestResult(allureTest);
        });
    }

    generate() {
        this.generateAllureResults();
        this.generateAllureReport();
    }

    createAllureTest(testCase) {
        const testId = uuidv4();
        const testCaseStatus = ttkReportHelpers.ifFailedTestCase(testCase) ? "failed" : "passed";

        return {
            uuid: testId,
            name: testCase.name,
            fullName: testCase.name,
            status: testCaseStatus,
            start: Date.now(),
            stop: Date.now(),
            labels: [{ name: "parentSuite", value: this.suiteName }],
            description: testCase.meta?.info || "No description available",
            parameters: [],
            steps: [],
            attachments: [],
        };
    }

    processRequests(testCase, allureTest) {
        testCase.requests.forEach((request) => {
            const step = this.createStep(request);
            allureTest.steps.push(step);
        });
    }

    createStep(request) {
        const requestStatus = this.getRequestStatus(request);
        const stepParameters = this.getStepParameters(request);
        const attachments = this.createAttachments(request);

        const assertionSteps = request.request.tests?.assertions.map((assertion) => ({
            name: assertion.description,
            status: assertion.resultStatus.status === "SUCCESS" ? "passed" : "failed",
            start: Date.now(),
            stop: Date.now(),
        }));

        return {
            name: request.request.description || "Unnamed Step",
            status: requestStatus,
            start: Date.now(),
            stop: Date.now(),
            parameters: stepParameters,
            steps: assertionSteps,
            attachments: attachments,
        };
    }

    getRequestStatus(request) {
        if (ttkReportHelpers.ifSkippedRequest(request.status)) {
            return "skipped";
        }
        return ttkReportHelpers.ifAllTestsPassedInRequest(request) ? "passed" : "failed";
    }

    getStepParameters(request) {
        return [
            { name: "Method", value: request.request.method.toUpperCase() },
            { name: "URL", value: request.request.path },
        ];
    }

    createAttachments(request) {
        const requestDetails = this.formatRequestDetails(request);
        const responseDetails = this.formatResponseDetails(request);
        const callbackDetails = this.formatCallbackDetails(request);

        const requestDetailsAttachment = this.createAttachment(requestDetails, "Request");
        const responseDetailsAttachment = this.createAttachment(responseDetails, "Response");
        const callbackDetailsAttachment = this.createAttachment(callbackDetails, "Callback");

        return [requestDetailsAttachment, responseDetailsAttachment, callbackDetailsAttachment];
    }

    createAttachment(details, name) {
        const attachmentId = uuidv4();
        fs.writeFileSync(path.join(this.resultsDir, `${attachmentId}.txt`), details);
        return {
            name: name,
            source: `${attachmentId}.txt`,
            type: "text/html",
        };
    }

    formatRequestDetails(request) {
        let details = `<b>${request.request.method.toUpperCase()} ${request.request.path}</b><br>`;
        details += `<b>Headers:</b><br><pre>${JSON.stringify(request.request.headers, null, 2)}</pre><br>`;
        if (request.request.body) {
            details += `<b>Body:</b><br><pre>${JSON.stringify(request.request.body, null, 2)}</pre><br>`;
        }
        return details;
    }

    formatResponseDetails(request) {
        if (!request.response) {
            return "No response received.<br>";
        }
        let details = `<b>Status:</b> ${request.response.status} ${request.response.statusText}<br>`;
        details += `<b>Headers:</b><br><pre>${JSON.stringify(request.response.headers, null, 2)}</pre><br>`;
        if (request.response.body) {
            details += `<b>Body:</b><br><pre>${JSON.stringify(request.response.body, null, 2)}</pre><br>`;
        }
        return details;
    }

    formatCallbackDetails(request) {
        if (!request.callback) {
            return "No callback received.<br>";
        }
        let details = `<b>URL:</b> ${request.callback.url}<br>`;
        details += `<b>Headers:</b><br><pre>${JSON.stringify(request.callback.headers, null, 2)}</pre><br>`;
        details += `<b>Body:</b><br><pre>${JSON.stringify(request.callback.body, null, 2)}</pre><br>`;
        return details;
    }

    writeTestResult(allureTest) {
        const testFilePath = path.join(this.resultsDir, `${allureTest.uuid}-result.json`);
        fs.writeFileSync(testFilePath, JSON.stringify(allureTest, null, 2));
    }

    generateAllureReport() {
        try {
            console.log("Generating Allure report...");
            const generation = allure(["generate", this.resultsDir, "--single-file", "--clean", "-o", this.reportDir]);
            generation.on("exit", (exitCode) => {
                if (exitCode === 0) {
                    // TODO: Customize html report
                }
            });

        } catch (error) {
            console.error("Failed to generate Allure report:", error.message);
        }
    }
}

module.exports = AllureReportGenerator;