import { Route, Routes } from 'react-router-dom';
import './App.css';
import { AppShell } from './components/AppShell';
import { copy } from './copy';
import { RegisterPage } from './pages/RegisterPage';

function Home() {
  return (
    <>
      <h1>{copy.homeHeading}</h1>
      <p>{copy.homeIntro}</p>
    </>
  );
}

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
