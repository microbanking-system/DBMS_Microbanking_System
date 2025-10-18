const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const app = require('./src/app');
const { startInterestSchedulers } = require('./src/scheduler/interestScheduler');

const PORT = process.env.PORT || 5000;

// Start schedulers (keeps previous behavior)
startInterestSchedulers();

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});