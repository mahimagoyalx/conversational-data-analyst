import Chat from "./components/Chat";

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>Conversational Data Analyst</h1>
      </header>
      <main>
        <Chat />
      </main>
    </div>
  );
}
