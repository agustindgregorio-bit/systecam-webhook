const express = require('express');
const app = express();
app.use(express.json());
const VERIFY_TOKEN = "systecam_cesy_2026";
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});
app.post('/webhook', (req, res) => {
  res.status(200).send('OK');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Corriendo en puerto ' + PORT));
