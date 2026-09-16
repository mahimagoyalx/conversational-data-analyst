import { createApp } from "./app.js";
import { openDatabase } from "./db/database.js";

const port = Number(process.env.PORT) || 3001;
const db = openDatabase();
const app = createApp({ db });

app.listen(port, "127.0.0.1", () => {
  console.log(`Server listening on http://127.0.0.1:${port}`);
});
