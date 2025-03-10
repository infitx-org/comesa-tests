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

const TTK_TESTS_QUEUE = 'TTK-TESTS';
const REPORT_GENERATION_QUEUE = 'REPORT_GENERATION';

const TTK_REPORTS_DIR = './reports/ttk_reports';
const ALLURE_REPORTS_DIR = './reports/allure_reports';
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
          { text: 'Reports', url: '/listReports' }
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
          const html = `
            <html lang="en" dir="ltr">
              <head>
                  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
                  <title>Reports</title>
                  <link href="/assets/styles/main.css" rel="stylesheet">
                  <link rel="stylesheet" type="text/css" href="/assets/styles/style.css">
              </head>
              <body class="dark-mode">
                  <div id="root">
                    <header class="header-dfryKG">
                        <a aria-current="page" class="logo-DC8O1O active" href="/">
                            <img src="/assets/images/comesa-blue-gp.png" class="img-ggCynO" width="100px" height="200" alt="">
                        </a>
                    </header>
                    <main>
                        <div>
                          <section>
                              ${folders.map(folder => `
                              <div class="card-xqyZlH card-BRjpw_">
                                <div class="header-Lw4QCc">
                                      <a class="jobLink-wmCWQg" target="_blank" href="/reports/${folder}">
                                        <h4>${folder}</h4>
                                      </a>
                                      </div>
                                      </div>
                              `).join("")}
                          </section>
                        </div>
                    </main>
                    <aside class="aside-tRszgh">
                        <nav>
                          <ul class="menu-zMsDO4">
                              <li><a aria-current="page" class="active-hKGR_B" title="TTK-TESTS" href="/"> < Back </a></li>
                          </ul>
                        </nav>
                    </aside>
                  </div>
              </body>
            </html>
          `;

          res.send(html);
      });
  });

  app.use('/', serverAdapter.getRouter());

  app.use('/startTestRun', async (req, res) => {
    // const opts = req.query.opts || {};
  
    const activeCount1 = await reportGenerationBullMq.getActiveCount()
    const activeCount2 = await ttkTestsBullMq.getActiveCount()
    if (activeCount1 > 0 || activeCount2 > 0) {
      return res.status(400).json({
        ok: false,
        message: 'There are already active jobs'
      });
    }
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
        reportDir: `${ALLURE_REPORTS_DIR}/$(date +%Y-%m-%d-%H-%M-%S)`,
      },
      children: Config.getMultiSchemeTestConfig().map((config) => ({
        name: `TTK Tests ${config.sourceDfspId} to ${config.targetDfspId}`,
        data: {
          testCollection: 'ttk-test-collection/multi-scheme-tests',
          ttkBackendHost: Config.getTestConfig().ttkBackendHost,
          envFilePath: `${ENV_DIR}/${config.ttkEnvFile}`,
          reportFilePrefix: `${config.sourceDfspId}-${config.targetDfspId}`,
          reportFilePath: `${TTK_REPORTS_DIR}/${config.sourceDfspId}-${config.targetDfspId}-report.json`,
          ...config
        },
        queueName: TTK_TESTS_QUEUE,
        opts: {
          ignoreDependencyOnFailure: true,
        }
      })),
    });

    res.json({
      ok: true,
    });
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
