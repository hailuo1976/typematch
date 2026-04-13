import { Routes, Route } from 'react-router-dom';
import LobbyPage from './pages/LobbyPage';
import RoomPage from './pages/RoomPage';
import GamePage from './pages/GamePage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import { useGameStore } from './stores/gameStore';

export default function App() {
  const currentPage = useGameStore((s) => s.currentPage);

  return (
    <div className="min-h-screen bg-game-bg">
      <Routes>
        <Route path="/" element={<PageRouter page={currentPage} />} />
      </Routes>
    </div>
  );
}

function PageRouter({ page }: { page: string }) {
  switch (page) {
    case 'lobby':
      return <LobbyPage />;
    case 'room':
      return <RoomPage />;
    case 'game':
      return <GamePage />;
    case 'results':
      return <ResultsPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <LobbyPage />;
  }
}
