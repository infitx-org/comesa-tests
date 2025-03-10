const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue: QueueMQ, Worker, FlowProducer } = require('bullmq');
const { spawn } = require('node:child_process');
const express = require('express');
const path = require('path');
const AllureReportGenerator = require("./lib/allureReportGenerator");
const Config = require('./lib/config');

const TTK_TESTS_QUEUE = 'TTK-TESTS';
const REPORT_GENERATION_QUEUE = 'REPORT_GENERATION';

const sleep = (t) => new Promise((resolve) => setTimeout(resolve, t * 1000));

const redisOptions = {
  port: 6379,
  host: 'localhost',
  password: '',
  tls: false,
};

const createQueueMQ = (name) => new QueueMQ(name, { connection: redisOptions });


// function setupSampleProcessor(queueName) {
//   new Worker(
//     queueName,
//     async (job) => {
//       for (let i = 0; i <= 100; i++) {
//         await sleep(Math.random());
//         await job.updateProgress(i);
//         await job.log(`Processing job at interval ${i}`);

//         if (Math.random() * 200 < 1) throw new Error(`Random error ${i}`);
//       }
//       return { jobId: `This is the return value of job (${job.id})` };
//     },
//     { connection: redisOptions, concurrency: 10 }
//   );
// }

function setupReportGenerationProcessor(queueName) {
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

function setupTtkTestsProcessor(queueName) {
  new Worker(
    queueName,
    async (job) => {
      return new Promise((resolve, reject) => {
        const ls = spawn('./node_modules/.bin/ml-ttk-cli', [
          '-i', job.data.testCollection,
          '-e', job.data.envFilePath,
          '-u', 'http://localhost:5050',
          '--report-format', 'json',
          '--save-report', 'true',
          '--report-target', `file://${job.data.reportFilePath}`,
          '--save-report-base-url', `https://reports.somedomain.com/${job.data.reportFilePrefix}`
        ]);

        ls.stdout.on('data', async (data) => {
          const stripAnsi = (await import('strip-ansi')).default;
          await job.log(stripAnsi(data.toString()));
        });

        ls.stderr.on('data', async (data) => {
          await job.log(`Error: ${data}`);
        });

        ls.on('close', (code) => {
          console.log(`child process exited with code ${code}`);
          if (code === 0) {
            resolve({ jobId: `This is the return value of job (${job.id})` });
          } else {
            reject(new Error(`Process exited with code ${code}`));
          }
        });
      });
    },
    { connection: redisOptions, concurrency: 10 }
  );
}

const run = async () => {
  const flowProducer = new FlowProducer();
  const reportGenerationBullMq = createQueueMQ(REPORT_GENERATION_QUEUE);
  const ttkTestsBullMq = createQueueMQ(TTK_TESTS_QUEUE);

  await setupTtkTestsProcessor(TTK_TESTS_QUEUE);
  await setupReportGenerationProcessor(REPORT_GENERATION_QUEUE);

  const app = express();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/ui');

  createBullBoard({
    queues: [
      new BullMQAdapter(reportGenerationBullMq, { allowRetries: true, readOnlyMode: false }),
      new BullMQAdapter(ttkTestsBullMq, { allowRetries: true, readOnlyMode: false }),
    ],
    
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'COMESA TESTS',
        boardLogo: {
          path: 'assets/images/comesa-blue.png',
          width: '100px',
          height: 200,
        },
        // miscLinks: [{text: 'Start Test', url: '/start-test'}],
        favIcon: {
          default: 'assets/images/favicon.png',
        },
      },
    },
  });

  // Serve static files from the "static" directory
  app.use('/assets', express.static(path.join(__dirname, '../assets')));

  app.use('/ui', serverAdapter.getRouter());

  app.use('/add', async (req, res) => {
    const opts = req.query.opts || {};

    // if (opts.delay) {
    //   opts.delay = +opts.delay * 1000; // delay must be a number
    // }
    // const activeCount = await reportGenerationBullMq.getActiveCount()
    // if (activeCount > 0) {
    //   return res.status(400).json({
    //     ok: false,
    //     message: 'There is already an active job'
    //   });
    // }
    // // Clear existing jobs
    await reportGenerationBullMq.drain();
    await reportGenerationBullMq.clean(0, 1000, 'completed');
    await reportGenerationBullMq.clean(0, 1000, 'failed');
    await reportGenerationBullMq.clean(0, 1000, 'active');
    await reportGenerationBullMq.clean(0, 1000, 'waiting');

    await ttkTestsBullMq.drain();
    await ttkTestsBullMq.clean(0, 1000, 'completed');
    await ttkTestsBullMq.clean(0, 1000, 'failed');
    await ttkTestsBullMq.clean(0, 1000, 'active');
    await ttkTestsBullMq.clean(0, 1000, 'waiting');

    // await ttkTestsBullMq.add(`Generate Report`, { title: req.query.title }, opts);
    // await reportGenerationBullMq.addBulk([
    //   { name: 'ZMW to MWK', data: { title: req.query.title }, opts },
    //   { name: 'MWK to ZMW', data: { title: req.query.title }, opts },
    // ]);
    // // await reportGenerationBullMq.add(`ZMW to MWK ${new Date().toISOString()}`, { title: req.query.title }, opts);
    // // await reportGenerationBullMq.add(`MWK to ZMW ${new Date().toISOString()}`, { title: req.query.title }, opts);
    const flow = await flowProducer.add({
      name: 'Generate Report',
      queueName: REPORT_GENERATION_QUEUE,
      data: {
        ttkReports: Config.getMultiSchemeTestConfig().map((config) => ({
          reportFilePath: `./docker/reports/${config.sourceDfspId}-${config.targetDfspId}-report.json`,
          suiteName: `${config.sourceDfspId} to ${config.targetDfspId}`,
        })),
        reportDir: './docker/reports',
      },
      children: Config.getMultiSchemeTestConfig().map((config) => ({
        name: `TTK Tests ${config.sourceDfspId} to ${config.targetDfspId}`,
        data: {
          testCollection: 'ttk-test-collection/multi-scheme-tests',
          envFilePath: `./docker/ttk/environments/${config.ttkEnvFile}`,
          reportFilePrefix: `${config.sourceDfspId}-${config.targetDfspId}`,
          reportFilePath: `./docker/reports/${config.sourceDfspId}-${config.targetDfspId}-report.json`,
          ...config
        },
        queueName: TTK_TESTS_QUEUE,
      })),
    });

    res.json({
      ok: true,
    });
  });

  app.listen(3000, () => {
    console.log('Running on 3000...');
    console.log('For the UI, open http://localhost:3000/ui');
    console.log('Make sure Redis is running on port 6379 by default');
    console.log('To populate the queue, run:');
    console.log('  curl http://localhost:3000/add?title=Example');
    console.log('To populate the queue with custom options (opts), run:');
    console.log('  curl http://localhost:3000/add?title=Test&opts[delay]=9');
  });
};

// eslint-disable-next-line no-console
run().catch((e) => console.error(e));


// const handleTermination = async () => {
//   log.info(`Gracefully shutting down worker for queue '${name}'.`);
//   await worker.close();
// };
// process.on('SIGTERM', handleTermination).on('SIGINT', handleTermination);
