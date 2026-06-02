import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import chatRoutes from "./routes/chat";
import entertainmentRoutes from "./routes/entertainment";
import sttRoutes from "./routes/stt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Expo static files in production
const clientDistPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDistPath, {
  maxAge: '1d',
  etag: false,
}));

// Health check
app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// API Routes
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/entertainment', entertainmentRoutes);
app.use('/api/v1/stt', sttRoutes);

// Serve React app for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening at http://0.0.0.0:${port}/`);
});
