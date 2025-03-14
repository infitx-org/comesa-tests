const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { FlowExecutor } = require('./flowExecutor');

const { constructHtml } = require('./lib/utils');

const ALLURE_REPORTS_DIR = './reports/allure_reports';

const run = async () => {

  const flowExecutor = new FlowExecutor();

  const app = express();

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/');

  createBullBoard({
    queues: [
      new BullMQAdapter(flowExecutor.waitBullMq, { allowRetries: true, readOnlyMode: false }),
      new BullMQAdapter(flowExecutor.staticTestsBullMq, { allowRetries: true, readOnlyMode: false }),
      new BullMQAdapter(flowExecutor.perSchemeTestsBullMq, { allowRetries: true, readOnlyMode: false }),
      new BullMQAdapter(flowExecutor.multiSchemeTestsBullMq, { allowRetries: true, readOnlyMode: false }),
      new BullMQAdapter(flowExecutor.reportGenerationBullMq, { allowRetries: true, readOnlyMode: false }),
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
  
    try {
      await flowExecutor.startTestRun();
      response = {
        ok: true,
        message: 'Triggered Test Run successfully'
      };
    } catch (e) {
      response ={
        ok: false,
        message: e.message
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
