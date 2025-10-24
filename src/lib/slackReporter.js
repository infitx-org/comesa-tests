const { IncomingWebhook } = require('@slack/webhook');
const fs = require('fs');
const path = require('path');
const releaseCd = require('./release-cd');

// TODO: Need to adjust the following values dynamically
const categoryMap = {
    "Per Scheme": "Per Scheme Tests",
    "Multi Scheme": "Multi Scheme Tests",
    "Static": "Static Tests"
};

const millisecondsToTime = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

class SlackReporter {

  constructor (config) {
    if (config.slackWebhookUrl) {
      this.webhook = new IncomingWebhook(config.slackWebhookUrl);
    }
    if (config.slackWebhookUrlForFailed) {
      this.webhookForFailed = new IncomingWebhook(config.slackWebhookUrlForFailed);
    }
    this.allureResultsPath = config.allureResultsPath || './reports/allure_results';
    this.showDetails = config.showDetails || false;
    this.slackWebhookDescription = config.slackWebhookDescription || '';
    this.releaseCdUrl = config.releaseCdUrl;
  }

  generateCombinedReport = async (reportURL, logs, startTime) => {
    const results = {};
    let totalPassed = 0;
    let totalTests = 0;


    // function countStepsRecursive(steps) {
    //     let total = 0, passed = 0;

    //     function traverse(steps) {
    //         steps.forEach(step => {
    //             total++;
    //             if (step.status === "passed") passed++;
    //             if (step.steps) traverse(step.steps);
    //         });
    //     }

    //     traverse(steps);
    //     return { passed, total };
    // }

    // function countSteps(steps) {
    //     let total = 0, passed = 0;

    //     steps.forEach(step => {
    //         total++;
    //         if (step.status === "passed") passed++;
    //     });

    //     return { passed, total };
    // }

    fs.readdirSync(this.allureResultsPath).forEach(file => {
        if (path.extname(file) === '.json') {
            const filePath = path.join(this.allureResultsPath, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            const suite = content.labels.find(label => label.name === "parentSuite")?.value || "Uncategorized";
            let category = "Uncategorized";

            let suiteName = '';
            for (const key in categoryMap) {
                if (suite.startsWith(key)) {
                    category = categoryMap[key];
                    suiteName = suite.replace(key, '').trim();
                    break;
                }
            }

            const testName = content.name;
            const testStatus = content.status;

            // We don't want to count assertion failures, just the test cases
            // So commenting the next line
            // const { passed, total } = countSteps(content.steps);

            const passed = testStatus === "passed" ? 1 : 0;
            const total = 1;

            totalPassed += passed;
            totalTests += total;
            const responseCode = `${passed}/${total}`;

            if (!results[category]) {
                results[category] = {};
            }
            if (!results[category][suiteName]) {
                results[category][suiteName] = [];
            }
            results[category][suiteName].push({ testName, testStatus, responseCode });
        }
    });

    const duration = Date.now() - startTime;

    await releaseCd({
      url: this.releaseCdUrl,
      report: reportURL,
      duration,
      totalPassedAssertions: totalPassed,
      totalAssertions: totalTests
    }, logs);

    const elements = [];
    Object.keys(results).sort().forEach(category => {
      if (this.showDetails) {
        const bullet = { type: "rich_text_section", elements: [] };
        elements.push({ type : "rich_text_list", elements: [bullet], style: "bullet" });
        bullet.elements.push({ type: "text", text: `${category}: ` });
        Object.keys(results[category]).sort().forEach(suiteName => {
            const suiteStatus = results[category][suiteName].every(test => test.testStatus === "passed");
            bullet.elements.push({ type: "text", text: ` ${suiteStatus ? "✅" : "⚠️"}${suiteName}` });
            results[category][suiteName].forEach(({ testName, testStatus, responseCode }) => {
                bullet.elements.push({ type: "text", text: `-  ${testStatus === "passed" ? "✅" : "⚠️"} ${testName} ` });
                bullet.elements.push({ type: "text", text: responseCode, style: { code: true } });
            });
        });
      } else {
        const bullet = { type: "rich_text_section", elements: [] };
        elements.push({ type : "rich_text_list", elements: [bullet], style: "bullet" });
        if (Object.keys(results[category]).length <= 8) {
          bullet.elements.push({ type: "text", text: `${category}: ` });
          Object.keys(results[category]).sort().forEach(suiteName => {
              const suiteStatus = results[category][suiteName].every(test => test.testStatus === "passed");
              bullet.elements.push({ type: "text", text: ` ${suiteStatus ? "✅" : "⚠️"}${suiteName}` });
          });
        } else {
          // generate summary for large categories
          const totalSuites = Object.keys(results[category]).length;
          const totalPassedSuites = Object.keys(results[category]).filter(suiteName =>
            results[category][suiteName].every(test => test.testStatus === "passed")
          ).length;
          bullet.elements.push({ type: "text", text: `${totalPassedSuites === totalSuites ? "✅" : "⚠️"}${category} `});
          bullet.elements.push({ type: "text", text: `${totalPassedSuites}/${totalSuites}`, style: { code: true } });
        }
      }
    });

    const isPassed = totalPassed === totalTests;
    return {
      blocks: [{
        type: 'rich_text',
        elements: [{
          type: 'rich_text_section',
          elements: [
            { type: 'text', text: `${isPassed ? '✅' : '⚠️'}${this.slackWebhookDescription} `},
            { type: 'link', url: reportURL, text: 'COMESA GP' },
            { type: 'text', text: ` tests: ` },
            { type: 'text', text: `${totalPassed}/${totalTests}`, style: { code: true } },
            { type: 'text', text: `, duration: ` },
            { type: 'text', text: millisecondsToTime(duration), style: { code: true } }
          ]
        }, ...elements]
      }],
      isPassed
    };
  }

  sendSlackNotification = async (reportURL = 'http://localhost/', startTime) => {
    const logs = [];
    if (!this.webhook && !this.webhookForFailed) {
      logs.push('No Slack webhook URLs configured.')
      return logs;
    }
    const { blocks, isPassed } = await this.generateCombinedReport(reportURL, logs, startTime)
    // console.log(JSON.stringify(blocks,null,2))
    // process.exit(0)

    if (this.webhook) {
      try {
        await this.webhook.send({
          blocks
        })
        logs.push('Slack notification sent.')
      } catch (err) {
        logs.push(`ERROR: Sending Slack notification failed. ${err.message}`)
      }
    }

    if (this.webhookForFailed && !isPassed) {
      try {
        await this.webhookForFailed.send({
          blocks
        })
        logs.push('Slack failure notification sent.')
      } catch (err) {
        logs.push(`ERROR: Sending Slack failure notification failed. ${err.message}`)
      }
    }
    return logs;
  }

}

module.exports = {
  SlackReporter
}