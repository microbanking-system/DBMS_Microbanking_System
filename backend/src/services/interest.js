const { pool } = require('../db');

const processDailyFDInterest = async () => {
  console.log('🚀 Starting daily FD interest processing (30-day per-account cycles)...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const today = new Date();
    const processDate = today.toISOString().split('T')[0];

    const interestCalculations = await client.query(
      `SELECT * FROM calculate_fd_interest_due($1)`,
      [processDate]
    );

    let creditedCount = 0;
    let totalInterest = 0;

    for (const calc of interestCalculations.rows) {
      if (calc.interest_amount > 0) {
        try {
          await client.query(
            `SELECT create_transaction_with_validation($1, $2, $3, $4, $5)`,
            ['Interest', calc.interest_amount, `Monthly FD Interest - ${calc.interest_rate}% Plan`, calc.linked_account_id, 1]
          );
          await client.query(
            `INSERT INTO fd_interest_calculations 
             (fd_id, calculation_date, interest_amount, days_in_period, credited_to_account_id, status, credited_at)
             VALUES ($1, $2, $3, $4, $5, 'credited', $6)`,
            [calc.fd_id, processDate, calc.interest_amount, calc.days_in_period, calc.linked_account_id, today]
          );
          creditedCount++;
          totalInterest += parseFloat(calc.interest_amount);
          console.log(`💰 Credited LKR ${calc.interest_amount} interest for FD ${calc.fd_id} to account ${calc.linked_account_id}`);
        } catch (error) {
          console.error(`❌ Failed to process interest for FD ${calc.fd_id}:`, error);
          await client.query(
            `INSERT INTO fd_interest_calculations 
             (fd_id, calculation_date, interest_amount, days_in_period, credited_to_account_id, status)
             VALUES ($1, $2, $3, $4, $5, 'failed')`,
            [calc.fd_id, processDate, calc.interest_amount, calc.days_in_period, calc.linked_account_id]
          );
        }
      }
    }

    const maturedResult = await client.query('SELECT * FROM process_matured_fixed_deposits()');
    const maturedData = maturedResult.rows[0];

    await client.query('COMMIT');

    console.log(`✅ Daily FD interest processing completed!`);
    console.log(`📊 FDs Processed: ${creditedCount}`);
    console.log(`💰 Total Interest Credited: LKR ${totalInterest.toLocaleString()}`);
    console.log(`🏁 Matured FDs Processed: ${maturedData.processed_count}`);
    console.log(`💵 Principal Returned: LKR ${maturedData.total_principal_returned.toLocaleString()}`);

    return {
      success: true,
      processed: creditedCount,
      totalInterest: totalInterest,
      maturedProcessed: maturedData.processed_count,
      principalReturned: maturedData.total_principal_returned,
      period: processDate,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in optimized FD interest processing:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
};

const processDailySavingsInterest = async () => {
  console.log('🚀 Starting daily savings interest processing (30-day per-account cycles)...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const today = new Date();
    const processDate = today.toISOString().split('T')[0];

    const interestCalculations = await client.query(
      `SELECT * FROM calculate_savings_interest_due($1)`,
      [processDate]
    );

    let creditedCount = 0;
    let totalInterest = 0;

    for (const calc of interestCalculations.rows) {
      if (calc.interest_amount > 0) {
        try {
          await client.query(
            `SELECT create_transaction_with_validation($1, $2, $3, $4, $5)`,
            ['Interest', calc.interest_amount, `Monthly Savings Interest - ${calc.plan_type} Plan`, calc.account_id, 1]
          );
          await client.query(
            `INSERT INTO savings_interest_calculations 
             (account_id, calculation_date, interest_amount, interest_rate, plan_type, status, credited_at)
             VALUES ($1, $2, $3, $4, $5, 'credited', $6)`,
            [calc.account_id, processDate, calc.interest_amount, calc.interest_rate, calc.plan_type, today]
          );
          creditedCount++;
          totalInterest += parseFloat(calc.interest_amount);
          console.log(`💰 Credited LKR ${calc.interest_amount} interest for account ${calc.account_id} (${calc.plan_type})`);
        } catch (error) {
          console.error(`❌ Failed to process interest for account ${calc.account_id}:`, error);
          await client.query(
            `INSERT INTO savings_interest_calculations 
             (account_id, calculation_date, interest_amount, interest_rate, plan_type, status)
             VALUES ($1, $2, $3, $4, $5, 'failed')`,
            [calc.account_id, processDate, calc.interest_amount, calc.interest_rate, calc.plan_type]
          );
        }
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Daily savings interest processing completed!`);
    console.log(`📊 Accounts Processed: ${creditedCount}`);
    console.log(`💰 Total Interest Credited: LKR ${totalInterest.toLocaleString()}`);
    console.log(`📅 Date: ${processDate}`);

    return {
      success: true,
      processed: creditedCount,
      totalInterest: totalInterest,
      period: processDate,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in optimized savings interest processing:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
};

module.exports = { processDailyFDInterest, processDailySavingsInterest };
