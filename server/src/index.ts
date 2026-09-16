import { createApp } from "./app.js";
import { openDatabase } from "./db/database.js";

const port = Number(process.env.PORT) || 3001;
const db = openDatabase();
const app = createApp({ db });

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
