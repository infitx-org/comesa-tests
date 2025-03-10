const { Worker } = require('bullmq');
const AllureReportGenerator = require("../lib/allureReportGenerator");

function setupReportGenerationProcessor(queueName, redisOptions) {
  new Worker(
    queueName,
    async (job) => {
      await job.log(`Generating Allure results for each TTK report file..`);
      const fileCount = job.data.ttkReports.length;
      const progressStep = 100 / (fileCount - 1);

      job.data.ttkReports.forEach((ttkReport, index) => {
        const purge = index == 0;
        const reportGenerator = new AllureReportGenerator({ ttkReportFile: ttkReport.reportFilePath, suiteName: ttkReport.suiteName, purge });
        reportGenerator.generateAllureResults();
        job.updateProgress(progressStep * (index + 1));
      });

      await job.log(`Generating the combined Allure report..`);
      new AllureReportGenerator({ reportDir: job.data.reportDir }).generateAllureReport();
      job.updateProgress(100);
      return { jobId: `This is the return value of job (${job.id})` };
    },
    { connection: redisOptions, concurrency: 1 }
  );
}

module.exports = {
    setupReportGenerationProcessor
};