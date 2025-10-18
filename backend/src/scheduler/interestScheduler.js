const cron = require('node-cron');
const { processDailyFDInterest, processDailySavingsInterest } = require('../services/interest');

const startInterestSchedulers = () => {
  const debug = process.env.INTEREST_CRON_DEBUG === '1';

  // In DEBUG, force both jobs to every minute regardless of explicit env
  const FD_CRON = debug ? '* * * * *' : (process.env.FD_INTEREST_CRON || '0 3 * * *');
  const SAVINGS_CRON = debug ? '* * * * *' : (process.env.SAVINGS_INTEREST_CRON || '30 3 * * *');

  cron.schedule(FD_CRON, processDailyFDInterest);
  cron.schedule(SAVINGS_CRON, processDailySavingsInterest);

  if (debug) {
    console.warn('⚠️ Interest processors set to DEBUG mode: forcing every-minute runs for FD and Savings.');
  }
  console.log(`✅ FD Interest Auto-Processor: Scheduled '${FD_CRON}'`);
  console.log(`✅ Savings Interest Auto-Processor: Scheduled '${SAVINGS_CRON}'`);
};

module.exports = { startInterestSchedulers };
