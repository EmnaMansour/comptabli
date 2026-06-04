import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useThemeStore } from '../../store/themeStore';

export default function MainLayout() {
  const { darkMode } = useThemeStore();

  return (
    <div className="app-layout" data-theme={darkMode ? 'dark' : 'light'}>
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="page-content animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
