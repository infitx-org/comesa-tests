const { Worker } = require('bullmq');
const AllureReportGenerator = require("../lib/allureReportGenerator");

function setupReportGenerationProcessor(queueName, redisOptions) {
  new Worker(
    queueName,
    async (job) => {
      await job.log(`Generating Allure results for each TTK report file..`);
      const fileCount = job.data.ttkReports.length;

      job.data.ttkReports.forEach((ttkReport, index) => {
        const purge = index == 0;
        const reportGenerator = new AllureReportGenerator({ ttkReportFile: ttkReport.reportFilePath, suiteName: ttkReport.suiteName, purge, resultsDir: job.data.resultsDir });
        reportGenerator.generateAllureResults();
        job.updateProgress(100 * (index + 1) / fileCount);
      });

      await job.log(`Generating the combined Allure report..`);
      try {
        await (new AllureReportGenerator({ reportDir: job.data.reportDir, resultsDir: job.data.resultsDir })).generateAllureReport();
        await job.log(`Generated report successfully`);
        job.updateProgress(100);
      } catch (error) {
        await job.log(`Failed to generate the report`);
        throw new Error(`Failed to generate the report`);
      }

      return { jobId: `This is the return value of job (${job.id})` };
    },
    { connection: redisOptions, concurrency: 1 }
  );
}

module.exports = {
    setupReportGenerationProcessor
};