'use strict';

const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Banking Transactions API listening on http://localhost:${PORT}`);
});
