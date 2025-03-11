const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue: QueueMQ, FlowProducer } = require('bullmq');
const express = require('express');
const path = require('path');
const fs = require('fs');
const Config = require('./lib/config');
const { setupReportGenerationProcessor } = require('./processors/reportGenerationProcessor');
const { setupTtkTestsProcessor } = require('./processors/ttkTestsProcessor');
const { constructHtml } = require('./lib/utils');

const TTK_TESTS_QUEUE = 'TTK-TESTS';
const REPORT_GENERATION_QUEUE = 'REPORT_GENERATION';

const TTK_REPORTS_DIR = './reports/ttk_reports';
const ALLURE_REPORTS_DIR = './reports/allure_reports';
const ALLURE_RESULTS_DIR = './reports/allure_results';
const ENV_DIR = './ttk-environments';

const redisOptions = Config.getRedisOptions();

const createQueueMQ = (name) => new QueueMQ(name, { connection: redisOptions });

const run = async () => {
  const flowProducer = new FlowProducer({ connection: redisOptions });
  const reportGenerationBullMq = createQueueMQ(REPORT_GENERATION_QUEUE);
  const ttkTestsBullMq = createQueueMQ(TTK_TESTS_QUEUE);

  await setupTtkTestsProcessor(TTK_TESTS_QUEUE, redisOptions);
  await setupReportGenerationProcessor(REPORT_GENERATION_QUEUE, redisOptions);

  const app = express();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/');

  createBullBoard({
    queues: [
      new BullMQAdapter(reportGenerationBullMq, { allowRetries: true, readOnlyMode: false }),
      new BullMQAdapter(ttkTestsBullMq, { allowRetries: true, readOnlyMode: false }),
    ],
    
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: '',
        boardLogo: {
          path: '/assets/images/comesa-blue-gp.png',
          width: '100px',
          height: 200,
        },
        miscLinks: [
          { text: 'Reports', url: '/listReports' },
          { text: 'Trigger Test Run', url: '/startTestRun' },
        ],
        favIcon: {
          default: '/assets/images/favicon.png',
        },
      },
    },
  });

  // Serve static files from the "static" directory
  app.use('/assets', express.static(path.join(__dirname, '../assets')));
    
  app.use('/reports', express.static(path.join(process.cwd(), ALLURE_REPORTS_DIR)));
  app.get("/listReports", (req, res) => {
      fs.readdir(ALLURE_REPORTS_DIR, { withFileTypes: true }, (err, files) => {
          if (err) {
              return res.status(500).send("Error reading directory");
          }

          // Filter only directories
          const folders = files.filter(file => file.isDirectory()).map(dir => dir.name);

          // Generate HTML page with links
          const html = constructHtml(`
            ${folders.map(folder => `
            <div class="card-xqyZlH card-BRjpw_">
              <div class="header-Lw4QCc">
                    <a class="jobLink-wmCWQg" target="_blank" href="/reports/${folder}">
                      <h4>${folder}</h4>
                    </a>
                    </div>
                    </div>
            `).join("")}`);

          res.send(html);
      });
  });

  app.use('/', serverAdapter.getRouter());

  app.use('/startTestRun', async (req, res) => {
    // const opts = req.query.opts || {};
    let response = {
      ok: false,
      message: ''
    };
  
    const activeCount1 = await reportGenerationBullMq.getActiveCount()
    const activeCount2 = await ttkTestsBullMq.getActiveCount()
    if (activeCount1 > 0 || activeCount2 > 0) {
      response ={
        ok: false,
        message: 'There are already active jobs'
      };
    } else {
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

      const flow = await flowProducer.add({
        name: 'Generate Report',
        queueName: REPORT_GENERATION_QUEUE,
        data: {
          ttkReports: Config.getMultiSchemeTestConfig().map((config) => ({
            reportFilePath: `${TTK_REPORTS_DIR}/${config.sourceDfspId}-${config.targetDfspId}-report.json`,
            suiteName: `${config.sourceDfspId} to ${config.targetDfspId}`,
          })),
          reportDir: `${ALLURE_REPORTS_DIR}/${new Date().toISOString().replace(/[:.]/g, '-')}`,
          resultsDir: `${ALLURE_RESULTS_DIR}`,
        },
        children: Config.getMultiSchemeTestConfig().map((config) => ({
          name: `TTK Tests ${config.sourceDfspId} to ${config.targetDfspId}`,
          data: {
            testCollection: 'ttk-test-collection/multi-scheme-tests',
            ttkBackendHost: Config.getTestConfig().ttkBackendHost,
            envFilePath: `${ENV_DIR}/${config.ttkEnvFile}`,
            reportFilePrefix: `${config.sourceDfspId}-${config.targetDfspId}`,
            reportFilePath: `${TTK_REPORTS_DIR}/${config.sourceDfspId}-${config.targetDfspId}-report.json`,
            reportDir: `${TTK_REPORTS_DIR}`,
            ...config
          },
          queueName: TTK_TESTS_QUEUE,
          opts: {
            ignoreDependencyOnFailure: true,
          }
        })),
      });
      response ={
        ok: true,
        message: 'Triggered Test Run successfully'
      };
    }
    // Generate HTML page with links
    const html = constructHtml(`
      <div class="card-xqyZlH card-BRjpw_">
        <div class="header-Lw4QCc">
          <h4 ${!response.ok ? 'style="color: red;"' : ''}>${response.message}</h4>
        </div>
      </div>
    `);
    res.send(html);
  });

  app.listen(3000, () => {
    console.log('Running on 3000...');
    console.log('For the UI, open http://localhost:3000/');
    console.log('Make sure Redis is running on port 6379 by default');
    console.log('To trigger a test run:');
    console.log('  curl http://localhost:3000/startTestRun');
  });
};

// eslint-disable-next-line no-console
run().catch((e) => console.error(e));


// const handleTermination = async () => {
//   log.info(`Gracefully shutting down worker for queue '${name}'.`);
//   await worker.close();
// };
// process.on('SIGTERM', handleTermination).on('SIGINT', handleTermination);
