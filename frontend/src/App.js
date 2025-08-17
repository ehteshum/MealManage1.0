import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Meals from './pages/Meals';
import Bazar from './pages/Bazar';
import Deposits from './pages/Deposits';
import Members from './pages/Members';
import MemberReport from './pages/MemberReport';
import Reports from './pages/Reports';
import AdminCleanup from './pages/AdminCleanup';
import MealChart from './pages/MealChart';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';

export default function App() {
  return (
    <Routes>
  <Route path="/auth/callback" element={<AuthCallback />} />
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<Signup />} />
  <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="meals" element={<Meals />} />
        <Route path="bazar" element={<Bazar />} />
        <Route path="deposits" element={<Deposits />} />
  <Route path="members" element={<Members />} />
  <Route path="members/:id" element={<MemberReport />} />
  <Route path="reports" element={<Reports />} />
  <Route path="meal-chart" element={<MealChart />} />
  <Route path="admin/cleanup" element={<AdminCleanup />} />
      </Route>
    </Routes>
  );
}
