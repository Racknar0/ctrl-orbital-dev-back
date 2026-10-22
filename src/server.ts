import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '127.0.0.1';

app.listen(port, host, () => {
  console.log(`Backend escuchando en http://${host}:${port}`);
});
